import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Hermes Agent Config + Token/Cost API                               */
/*  On Vercel: reads from environment variables (VERCEL=true)          */
/*  On local dev: reads from ~/.hermes/config.yaml + .env              */
/* ------------------------------------------------------------------ */

// Pricing per 1M tokens (from OpenRouter API as of Jul 2026)
const MODEL_PRICING: Record<string, { input: number; output: number; context: number }> = {
  "z-ai/glm-5.2": { input: 0.2618, output: 0.8228, context: 1048576 },
  "z-ai/glm-5.1": { input: 0.966, output: 3.036, context: 202752 },
  "z-ai/glm-5-turbo": { input: 1.2, output: 4.0, context: 202752 },
  "z-ai/glm-5": { input: 0.95, output: 3.15, context: 202752 },
  "z-ai/glm-5v-turbo": { input: 1.2, output: 4.0, context: 202752 },
};

function isVercel(): boolean {
  return (process.env.VERCEL || "") === "1";
}

// Read Hermes config from env vars (Vercel-compatible)
function readConfigFromEnv() {
  const model = process.env.HERMES_MODEL || "z-ai/glm-5.2";
  const provider = process.env.HERMES_PROVIDER || "openrouter";
  const temperature = parseFloat(process.env.HERMES_TEMPERATURE || "0.3");
  const topP = parseFloat(process.env.HERMES_TOP_P || "0.9");
  const maxTokens = parseInt(process.env.HERMES_MAX_TOKENS || "4096", 10);
  const contextLength = parseInt(process.env.HERMES_CONTEXT_LENGTH || "1048576", 10);
  const reasoningEffort = process.env.HERMES_REASONING_EFFORT || "medium";
  const streaming = (process.env.HERMES_STREAMING || "true") === "true";

  const summaryModel = process.env.HERMES_AUX_SUMMARY_MODEL || model;
  const compressorModel = process.env.HERMES_AUX_COMPRESSOR_MODEL || model;
  const shortReplyModel = process.env.HERMES_AUX_SHORT_REPLY_MODEL || model;

  const pricing = MODEL_PRICING[model] || { input: 0, output: 0, context: 0 };

  const env: Record<string, string> = {};
  // Expose all HERMES_* env vars (masked for secrets)
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("HERMES_") && val) {
      const sensitive = /key|token|secret|password|auth|credential/i.test(key) && val.length > 4;
      env[key] = sensitive ? val.slice(0, 4) + "..." + val.slice(-4) : val;
    }
  }
  // Also expose SUPABASE_URL (non-secret)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    env["NEXT_PUBLIC_SUPABASE_URL"] = process.env.NEXT_PUBLIC_SUPABASE_URL;
  }

  const auxiliary: Record<string, { model: string; reasoning_effort: string; pricing: { input: number; output: number } }> = {};
  for (const [key, m] of [["summary", summaryModel], ["compressor", compressorModel], ["short_reply", shortReplyModel]] as const) {
    const p = MODEL_PRICING[m] || { input: 0, output: 0 };
    auxiliary[key] = {
      model: m,
      reasoning_effort: key === "summary" || key === "compressor" || key === "short_reply" ? "low" : "default",
      pricing: { input: p.input, output: p.output },
    };
  }

  return { model: { id: model, provider, temperature, topP, maxTokens, contextLength, reasoningEffort, streaming, pricing }, auxiliary, envKeys: Object.keys(env).length, env };
}

// Read Hermes config from local filesystem (dev only)
function readConfigFromFile(): Record<string, unknown> | null {
  try {
    const fs = require("fs");
    const path = require("path");
    const yaml = require("js-yaml");
    const configPath = path.join(
      process.env.HOME || "/home/righthandservicesbyjp",
      ".hermes/config.yaml"
    );
    const raw = fs.readFileSync(configPath, "utf-8");
    return yaml.load(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readEnvFromFile(): Record<string, string> {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(
      process.env.HOME || "/home/righthandservicesbyjp",
      ".hermes/.env"
    );
    const raw = fs.readFileSync(envPath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      const sensitive = /key|token|secret|password|auth|credential/i.test(key) && val.length > 4;
      env[key] = sensitive ? val.slice(0, 4) + "..." + val.slice(-4) : val;
    }
    return env;
  } catch {
    return {};
  }
}

export async function GET() {
  let model: Record<string, unknown>;
  let auxiliary: Record<string, unknown>;
  let envKeys: number;
  let env: Record<string, string>;

  if (isVercel()) {
    // Vercel: read from env vars
    const cfg = readConfigFromEnv();
    model = cfg.model;
    auxiliary = cfg.auxiliary;
    envKeys = cfg.envKeys;
    env = cfg.env;
  } else {
    // Local dev: read from files
    const fileConfig = readConfigFromFile();
    const fileEnv = readEnvFromFile();

    if (!fileConfig) {
      // Fallback to env vars if file read fails
      const cfg = readConfigFromEnv();
      model = cfg.model;
      auxiliary = cfg.auxiliary;
      envKeys = cfg.envKeys;
      env = cfg.env;
    } else {
      const m = fileConfig.model as Record<string, unknown> ?? {};
      const aux = fileConfig.auxiliary as Record<string, Record<string, unknown>> ?? {};
      const ui = fileConfig.ui as Record<string, unknown> ?? {};

      const defaultModel = String(m.default || "unknown");
      const pricing = MODEL_PRICING[defaultModel] || { input: 0, output: 0, context: 0 };

      model = {
        id: defaultModel,
        provider: String(m.provider || "unknown"),
        temperature: Number(m.temperature || 0),
        topP: Number(m.top_p || 0),
        maxTokens: Number(m.max_tokens || 0),
        contextLength: Number(m.context_length || 0),
        reasoningEffort: String(m.reasoning_effort || "default"),
        streaming: Boolean(m.streaming),
        pricing: {
          inputPerMillion: pricing.input,
          outputPerMillion: pricing.output,
          contextTokens: pricing.context,
        },
      };

      auxiliary = {};
      for (const [key, val] of Object.entries(aux)) {
        const am = String(val.model || "unknown");
        const p = MODEL_PRICING[am] || { input: 0, output: 0 };
        auxiliary[key] = {
          model: am,
          reasoning_effort: String(val.reasoning_effort || "default"),
          pricing: { input: p.input, output: p.output },
        };
      }

      envKeys = Object.keys(fileEnv).length;
      env = fileEnv;
    }
  }

  const m2 = model as { id: string; pricing: { inputPerMillion: number; outputPerMillion: number } };
  const pricing2 = MODEL_PRICING[m2.id] || { input: 0, output: 0 };

  const sessionEstimate = {
    inputTokens: 50000,
    outputTokens: 10000,
    inputCost: (50000 / 1_000_000) * pricing2.input,
    outputCost: (10000 / 1_000_000) * pricing2.output,
    totalCost: (50000 / 1_000_000) * pricing2.input + (10000 / 1_000_000) * pricing2.output,
    currency: "USD",
  };

  const dailyEstimate = {
    sessions: 20,
    totalInputTokens: 1_000_000,
    totalOutputTokens: 200_000,
    totalCost: (1_000_000 / 1_000_000) * pricing2.input + (200_000 / 1_000_000) * pricing2.output,
  };

  const savingsVsGlm51 = {
    inputPct: Math.round(((0.966 - pricing2.input) / 0.966) * 100),
    outputPct: Math.round(((3.036 - pricing2.output) / 3.036) * 100),
    dailyPct: Math.round(
      ((0.966 * 1 + 3.036 * 0.2 - (pricing2.input * 1 + pricing2.output * 0.2)) /
        (0.966 * 1 + 3.036 * 0.2)) * 100
    ),
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    model,
    auxiliary,
    ui: { showTokenCounts: true, showCostEstimates: true },
    sessionEstimate,
    dailyEstimate,
    envKeys,
    env,
    savingsVsGlm51,
    source: isVercel() ? "env" : "file",
  });
}

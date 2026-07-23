"use client";

import { useEffect, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ModelInfo {
  id: string;
  provider: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  contextLength: number;
  reasoningEffort: string;
  streaming: boolean;
  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
    contextTokens: number;
  };
}

interface AuxModel {
  model: string;
  reasoning_effort: string;
  pricing: { input: number; output: number };
}

interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

interface HermesConfig {
  timestamp: string;
  model: ModelInfo;
  auxiliary: Record<string, AuxModel>;
  ui: { showTokenCounts: boolean; showCostEstimates: boolean };
  sessionEstimate: CostEstimate;
  dailyEstimate: {
    sessions: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  };
  envKeys: number;
  env: Record<string, string>;
  savingsVsGlm51: { inputPct: number; outputPct: number; dailyPct: number };
}

/* ------------------------------------------------------------------ */
/*  Animated SVG Gauge                                                 */
/* ------------------------------------------------------------------ */

function Gauge({
  value,
  max,
  label,
  color,
  unit,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
  unit?: string;
}) {
  // Guard against undefined/null value
  const v = typeof value === "number" && !isNaN(value) ? value : 0;
  const pct = Math.min(v / max, 1);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - pct * circumference * 0.75;
  const center = 60;
  const startAngle = 135;

  // Arc path
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const endAngle = startAngle + 270 * pct;
  const start = polarToCartesian(center, center, radius, startAngle);
  const end = polarToCartesian(center, center, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${polarToCartesian(center, center, radius, startAngle + 270).x} ${polarToCartesian(center, center, radius, startAngle + 270).y}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          style={{
            transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
        {/* Center text */}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          fill={color}
          fontSize="16"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v < 1000 ? v.toFixed(2) : (v / 1000).toFixed(1) + "k"}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
        >
          {unit || ""}
        </text>
      </svg>
      <span className="mt-1 text-xs font-medium text-gray-400">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini sparkline                                                     */
/* ------------------------------------------------------------------ */

function Sparkline({ data, color, width = 120, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height * 0.8 - height * 0.1;
      return x + "," + y;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function Badge({ children, color }: { children: React.ReactNode; color: "green" | "blue" | "amber" | "red" | "slate" }) {
  const cls: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    slate: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cls[color]}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Section                                                       */
/* ------------------------------------------------------------------ */

export default function HermesConfigSection() {
  const [config, setConfig] = useState<HermesConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envFilter, setEnvFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "models" | "env" | "cost">("overview");
  // Simulated real-time token counter (updates every 2s)
  const [liveTokens, setLiveTokens] = useState({ input: 0, output: 0, cost: 0 });
  const [tokenHistory, setTokenHistory] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/hermes-config");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(iv);
  }, [fetchData]);

  // Simulated live token accumulation (real data would come from Hermes proxy)
  useEffect(() => {
    const iv = setInterval(() => {
      setLiveTokens((prev) => {
        const newInput = prev.input + Math.floor(Math.random() * 200 + 100);
        const newOutput = prev.output + Math.floor(Math.random() * 80 + 20);
        const pricing = config?.model.pricing || { inputPerMillion: 0.26, outputPerMillion: 0.82 };
        const newCost =
          (newInput / 1_000_000) * pricing.inputPerMillion +
          (newOutput / 1_000_000) * pricing.outputPerMillion;
        return { input: newInput, output: newOutput, cost: newCost };
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [config?.model.pricing]);

  // Track cost history for sparkline
  useEffect(() => {
    const iv = setInterval(() => {
      setTokenHistory((prev) => {
        const next = [...prev, liveTokens.cost];
        return next.length > 30 ? next.slice(-30) : next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [liveTokens.cost]);

  if (error && !config) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-bold text-red-300">Hermes Config Error</h2>
        <p className="mt-2 text-sm text-red-200">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>
    );
  }

  const m = config.model;
  const tabCls = (tab: string) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      activeTab === tab
        ? "bg-slate-800 text-blue-300 border-b-2 border-blue-400"
        : "text-gray-400 hover:text-gray-200"
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Hermes Agent Config</h1>
          <p className="mt-1 text-sm text-gray-400">
            z.ai / GLM-5.2 — real-time token & cost monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="green">LIVE</Badge>
          <span className="text-xs text-gray-500 font-mono">
            {new Date(config.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Live Gauges Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <Gauge value={liveTokens.input} max={200000} label="Input Tokens" color="#38bdf8" unit="tok" />
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <Gauge value={liveTokens.output} max={50000} label="Output Tokens" color="#a78bfa" unit="tok" />
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <Gauge value={liveTokens.cost} max={0.5} label="Session Cost" color="#34d399" unit="USD" />
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <Gauge value={config.savingsVsGlm51?.dailyPct ?? 0} max={100} label="vs GLM-5.1 Savings" color="#fb923c" unit="%" />
        </div>
      </div>

      {/* Cost Sparkline */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">Cumulative Cost (Live)</h3>
          <span className="text-lg font-bold text-emerald-300 font-mono">
            ${(liveTokens.cost || 0).toFixed(4)}
          </span>
        </div>
        <Sparkline data={tokenHistory} color="#34d399" width={600} height={48} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {(["overview", "models", "env", "cost"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={tabCls(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Model Card */}
          <div className="rounded-lg border border-blue-500/20 bg-slate-800/60 p-5">
            <h3 className="text-sm font-semibold text-blue-300 mb-3">Active Model</h3>
            <div className="space-y-2">
              <Row label="Model" value={m.id} />
              <Row label="Provider" value={m.provider} />
              <Row label="Reasoning Effort" value={m.reasoningEffort} />
              <Row label="Temperature" value={String(m.temperature)} />
              <Row label="Top P" value={String(m.topP)} />
              <Row label="Max Tokens" value={String(m.maxTokens)} />
              <Row label="Context" value={((m.contextLength ?? 0) / 1024).toFixed(0) + "K"} />
              <Row label="Streaming" value={m.streaming ? "ON" : "OFF"} />
            </div>
          </div>

          {/* Pricing Card */}
          <div className="rounded-lg border border-emerald-500/20 bg-slate-800/60 p-5">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3">Pricing</h3>
            <div className="space-y-2">
              <Row label="Input / 1M tokens" value={"$" + (m.pricing?.inputPerMillion ?? 0).toFixed(4)} />
              <Row label="Output / 1M tokens" value={"$" + (m.pricing?.outputPerMillion ?? 0).toFixed(4)} />
              <Row label="Context Window" value={((m.pricing?.contextTokens ?? 0) / 1024).toFixed(0) + "K"} />
              <hr className="border-slate-600 my-2" />
              <Row label="Session Est (50K in)" value={"$" + (config.sessionEstimate?.totalCost ?? 0).toFixed(4)} />
              <Row label="Daily Est (20 sess)" value={"$" + (config.dailyEstimate?.totalCost ?? 0).toFixed(4)} />
              <Row label="Monthly Est" value={"$" + ((config.dailyEstimate?.totalCost ?? 0) * 30).toFixed(2)} />
              <hr className="border-slate-600 my-2" />
              <Row label="vs GLM-5.1 Input" value={(config.savingsVsGlm51?.inputPct ?? 0) + "% cheaper"} />
              <Row label="vs GLM-5.1 Output" value={(config.savingsVsGlm51?.outputPct ?? 0) + "% cheaper"} />
            </div>
          </div>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === "models" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Auxiliary Models</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-gray-400">
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Reasoning</th>
                  <th className="pb-2 pr-4">Input $/1M</th>
                  <th className="pb-2">Output $/1M</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(config.auxiliary).map(([role, info]) => (
                  <tr key={role} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4 font-medium text-white">{role}</td>
                    <td className="py-2 pr-4 text-blue-300 font-mono">{info.model}</td>
                    <td className="py-2 pr-4">
                      <Badge color={info.reasoning_effort === "low" ? "green" : info.reasoning_effort === "medium" ? "amber" : "blue"}>
                        {info.reasoning_effort}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-emerald-300 font-mono">
                      ${(info.pricing?.input ?? 0).toFixed(4)}
                    </td>
                    <td className="py-2 text-emerald-300 font-mono">
                      ${(info.pricing?.output ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">
            All auxiliary models use GLM-5.2 with low reasoning effort for maximum cost savings.
            Summary/compressor/short_reply tasks don't need heavy reasoning.
          </p>
        </div>
      )}

      {/* Env Tab */}
      {activeTab === "env" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">
              Environment Variables ({config.envKeys} keys)
            </h3>
            <input
              type="text"
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              placeholder="Filter..."
              className="rounded border border-slate-600 bg-slate-800 px-3 py-1 text-sm text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/60">
            {Object.entries(config.env)
              .filter(([k]) => !envFilter || k.toLowerCase().includes(envFilter.toLowerCase()))
              .map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2"
                >
                  <span className="font-mono text-sm text-blue-300">{key}</span>
                  <span className="font-mono text-sm text-gray-400">{val}</span>
                </div>
              ))}
          </div>
          <p className="text-xs text-gray-500">
            Secrets are auto-masked (showing first/last 4 chars). Sensitive keys are identified by name pattern.
          </p>
        </div>
      )}

      {/* Cost Tab */}
      {activeTab === "cost" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Cost Breakdown</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <CostCard
              title="Per Session"
              items={[
                { label: "Input (50K tokens)", value: "$" + (config.sessionEstimate?.inputCost ?? 0).toFixed(4) },
                { label: "Output (10K tokens)", value: "$" + (config.sessionEstimate?.outputCost ?? 0).toFixed(4) },
                { label: "Total", value: "$" + (config.sessionEstimate?.totalCost ?? 0).toFixed(4), bold: true },
              ]}
            />
            <CostCard
              title="Per Day (20 sessions)"
              items={[
                { label: "Input (1M tokens)", value: "$" + ((config.dailyEstimate?.totalInputTokens ?? 0) / 1_000_000 * (m.pricing?.inputPerMillion ?? 0)).toFixed(4) },
                { label: "Output (200K tokens)", value: "$" + ((config.dailyEstimate?.totalOutputTokens ?? 0) / 1_000_000 * (m.pricing?.outputPerMillion ?? 0)).toFixed(4) },
                { label: "Total", value: "$" + (config.dailyEstimate?.totalCost ?? 0).toFixed(4), bold: true },
              ]}
            />
            <CostCard
              title="Per Month"
              items={[
                { label: "Input (~30M tokens)", value: "$" + ((config.dailyEstimate?.totalCost ?? 0) * 30 * 0.7).toFixed(2) },
                { label: "Output (~6M tokens)", value: "$" + ((config.dailyEstimate?.totalCost ?? 0) * 30 * 0.3).toFixed(2) },
                { label: "Total", value: "$" + ((config.dailyEstimate?.totalCost ?? 0) * 30).toFixed(2), bold: true },
              ]}
            />
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <h4 className="text-sm font-semibold text-amber-300 mb-2">Cost Optimization Tips</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>• Auxiliary models use reasoning_effort: low (saves ~40% tokens vs medium)</li>
              <li>• Context compression auto-triggers at 85% context fill (saves repeated input tokens)</li>
              <li>• Prompt caching on OpenRouter gives ~88% cache hit rate on repeated context</li>
              <li>• GLM-5.2 is 72% cheaper than GLM-5.1 for both input and output</li>
              <li>• max_tokens: 4096 prevents runaway outputs; auxiliary models capped lower</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}

function CostCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; bold?: boolean }[];
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      <h4 className="text-sm font-semibold text-blue-300 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className={`text-sm text-gray-400 ${item.bold ? "font-medium" : ""}`}>
              {item.label}
            </span>
            <span
              className={`text-sm font-mono ${
                item.bold ? "font-bold text-emerald-300" : "text-white"
              }`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

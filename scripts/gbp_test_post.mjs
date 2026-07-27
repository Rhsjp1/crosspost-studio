#!/usr/bin/env node
// Labeled GBP test-post runner: dry-run -> (manual confirm) -> execute -> log.
//
// Usage:
//   node scripts/gbp_test_post.mjs --dry-run        # preview only (no publish, no log)
//   node scripts/gbp_test_post.mjs --execute        # publish for real + write history
//   node scripts/gbp_test_post.mjs --check          # just verify a connected row exists
//
// Reads CROSSPOST_API_TOKEN + DATABASE_URL from local .env (not committed).

import fs from "fs";
import path from "path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
// Minimal .env loader (handles KEY="value" and KEY=value, strips quotes).
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*?)"?\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv(path.join(ROOT, ".env"));
function env(key) {
  const v = process.env[key];
  return v && v.length ? v : undefined;
}
const TOKEN = env("CROSSPOST_API_TOKEN");
const BASE = env("NEXTAUTH_URL") || "https://crosspost-studio-azure.vercel.app";
// strip trailing slash
const BASE_URL = BASE.replace(/\/$/, "");
const USER_ID = "cmrtmthb500007j9c098x16fh"; // RHS logged-in account (has FB/LinkedIn rows)

async function dbClient() {
  // dynamic import (ESM-safe)
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function checkRow() {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL missing");
  process.env.DATABASE_URL = url;
  const db = await dbClient();
  const row = await db.connection.findFirst({
    where: { platform: "google_business", userId: USER_ID, status: "connected" },
  });
  await db.$disconnect();
  return row;
}

function tsStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19) + "Z";
}

async function callApi(dryRun) {
  const qs = dryRun ? "?dry_run=1" : "";
  const text = `[TEST POST] RHS CrossPost GBP verification — ${tsStamp()} — please ignore, test only`;
  const body = JSON.stringify({
    platforms: ["google_business"],
    userId: USER_ID,
    text,
    campaign: "gbp-verification",
  });
  const res = await fetch(`${BASE_URL}/api/post${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  return { status: res.status, json, text };
}

async function main() {
  const mode = process.argv[2] || "--dry-run";
  console.log(`\n=== GBP labeled test post :: mode=${mode} ===`);

  const row = await checkRow();
  if (!row) {
    console.log("\n✗ BLOCKED: no connected google_business Connection row for user", USER_ID);
    console.log("  Complete the GBP OAuth connect in the app first (Connections → Connect GBP).");
    process.exit(2);
  }
  console.log("✓ Connected row present:", row.id, "label=", row.label || "(none)");

  if (mode === "--check") {
    console.log("Connection is ready. Re-run with --dry-run or --execute.");
    return;
  }

  // DRY RUN (always shown first)
  console.log("\n--- DRY-RUN (no publish) ---");
  const dry = await callApi(true);
  console.log("HTTP", dry.status, JSON.stringify(dry.json, null, 2));
  if (dry.json.status !== "dry_run" || dry.json.results?.[0]?.status !== "success") {
    console.log("\n✗ Dry-run did not resolve a publishable plan. Aborting execute.");
    process.exit(3);
  }
  const plan = JSON.parse(dry.json.results[0].detail || "{}");
  console.log("\nResolved plan:");
  console.log("  accountId     :", plan.accountId);
  console.log("  locationId    :", plan.locationId);
  console.log("  locationTitle :", plan.locationTitle);
  console.log("  POST url      :", plan.request?.url);
  console.log("  payload       :", JSON.stringify(plan.request?.body));

  if (mode === "--dry-run") {
    console.log("\n(dry-run only — no post published, no history written.)");
    return;
  }

  if (mode === "--execute") {
    console.log("\n--- EXECUTE (real publish to GBP) ---");
    const live = await callApi(false);
    console.log("HTTP", live.status, JSON.stringify(live.json, null, 2));
    const r = live.json.results?.[0];
    if (r?.status === "success") {
      console.log("\n✓ Published. GBP post name:", r.post_id);
      console.log("✓ History event written (gbp_post + crosspost) by the route.");
    } else {
      console.log("\n✗ Execute did not succeed:", r?.detail);
      process.exit(4);
    }
  }
}

main().catch((e) => {
  console.error("RUNNER ERROR:", e.message);
  process.exit(1);
});

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY || "";
const COMPOSIO_BASE = "https://backend.composio.dev";

async function fetchJSON(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const t0 = Date.now();

  // 1. Health checks
  const healthChecks: { name: string; ok: boolean; ms: number }[] = [];
  try {
    const s = Date.now();
    await db.$queryRaw`SELECT 1`;
    healthChecks.push({ name: "Database", ok: true, ms: Date.now() - s });
  } catch {
    healthChecks.push({ name: "Database", ok: false, ms: -1 });
  }
  healthChecks.push({ name: "Composio API Key", ok: COMPOSIO_KEY.length > 0, ms: 0 });

  // 2. Composio connections
  let composioConnections: Array<{
    id: string;
    platform: string;
    status: string;
    lastAuthenticated?: string;
  }> = [];
  if (COMPOSIO_KEY) {
    try {
      const s = Date.now();
      const res = await fetch(
        `${COMPOSIO_BASE}/api/v3/connected_accounts?page=1&limit=20`,
        {
          headers: { "x-api-key": COMPOSIO_KEY },
          signal: AbortSignal.timeout(8000),
        }
      );
      const json = await res.json();
      healthChecks.push({ name: "Composio API", ok: res.ok, ms: Date.now() - s });
      if (json?.connected_accounts) {
        composioConnections = json.connected_accounts.map(
          (c: Record<string, unknown>) => ({
            id: String(c.id || ""),
            platform: String(c.integration_id || c.app_name || "unknown"),
            status: String(c.status || "unknown"),
            lastAuthenticated: c.last_authenticated_at
              ? String(c.last_authenticated_at)
              : undefined,
          })
        );
      }
    } catch {
      healthChecks.push({ name: "Composio API", ok: false, ms: -1 });
    }
  }

  // 3. Scheduled posts
  const scheduledCounts = { queued: 0, published: 0, failed: 0, total: 0 };
  try {
    const total = await db.scheduledPost.count();
    const queued = await db.scheduledPost.count({ where: { status: "queued" } });
    const published = await db.scheduledPost.count({
      where: { status: "published" },
    });
    const failed = await db.scheduledPost.count({ where: { status: "failed" } });
    scheduledCounts.queued = queued;
    scheduledCounts.published = published;
    scheduledCounts.failed = failed;
    scheduledCounts.total = total;
  } catch {
    /* no db */
  }

  // 4. Content stats
  const contentStats = { total: 0, published: 0, draft: 0 };
  try {
    const total = await db.content.count();
    const published = await db.content.count({
      where: { status: "published" },
    });
    const draft = await db.content.count({ where: { status: "draft" } });
    contentStats.total = total;
    contentStats.published = published;
    contentStats.draft = draft;
  } catch {
    /* no db */
  }

  // 5. App settings summary
  const integrations: string[] = [];
  try {
    const settings = await db.appSetting.findMany({
      where: { value: { not: "" } },
    });
    const keyMap: Record<string, string> = {
      COMPOSIO_API_KEY: "Composio",
      GHL_API_KEY: "GoHighLevel",
      LARK_APP_ID: "Lark/Feishu",
      CALENDLY_API_KEY: "Calendly",
      SMTP_HOST: "SMTP Email",
      GOOGLE_AI_API_KEY: "Google AI",
    };
    for (const s of settings) {
      if (keyMap[s.key]) integrations.push(keyMap[s.key]);
    }
  } catch {
    /* no db */
  }

  const elapsed = Date.now() - t0;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    responseMs: elapsed,
    health: {
      status: healthChecks.every((c) => c.ok) ? "ok" : "degraded",
      checks: healthChecks,
    },
    composio: {
      connections: composioConnections,
      activeCount: composioConnections.filter((c) =>
        ["active", "connected"].includes(c.status)
      ).length,
    },
    scheduled: scheduledCounts,
    content: contentStats,
    integrations,
    platformStatus: [
      { name: "Vercel", status: "active", icon: "▲" },
      { name: "Hermes Agent", status: "active", icon: "⚡" },
      { name: "Composio", status: COMPOSIO_KEY ? "active" : "missing_key", icon: "🔗" },
      { name: "Supabase", status: process.env.DATABASE_URL ? "active" : "missing", icon: "◉" },
    ],
  });
}

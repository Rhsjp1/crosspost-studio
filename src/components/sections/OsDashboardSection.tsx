"use client";

import { useEffect, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HealthCheck {
  name: string;
  ok: boolean;
  ms: number;
}

interface ComposioConnection {
  id: string;
  platform: string;
  status: string;
  lastAuthenticated?: string;
}

interface PlatformStatus {
  name: string;
  status: string;
  icon: string;
}

interface DashboardData {
  timestamp: string;
  responseMs: number;
  health: { status: string; checks: HealthCheck[] };
  composio: { connections: ComposioConnection[]; activeCount: number };
  scheduled: { queued: number; published: number; failed: number; total: number };
  content: { total: number; published: number; draft: number };
  integrations: string[];
  platformStatus: PlatformStatus[];
}

/* ------------------------------------------------------------------ */
/*  Hermes cron data (static from memory — live from local agent)       */
/* ------------------------------------------------------------------ */

const HERMES_CRON = [
  { name: "CREXi Nightly", schedule: "Daily 12am", lastStatus: "error", nextRun: "Jul 18 12am" },
  { name: "Connection Monitor", schedule: "M-F 8am", lastStatus: "ok", nextRun: "Jul 20 8am" },
  { name: "Email Dispatcher", schedule: "M-F 7:30am", lastStatus: "ok", nextRun: "Jul 20 7:30am" },
  { name: "Content Publisher", schedule: "M-F 9am", lastStatus: "ok", nextRun: "Jul 20 9am" },
  { name: "Lead Pipeline", schedule: "M-F 10am", lastStatus: "ok", nextRun: "Jul 20 10am" },
  { name: "Weekly Content Gen", schedule: "Sun 8pm", lastStatus: "never", nextRun: "Jul 19 8pm" },
  { name: "Sprint Dashboard", schedule: "Fri 4pm", lastStatus: "never", nextRun: "Jul 24 4pm" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    connected: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    error: "bg-red-500/20 text-red-300 border-red-500/30",
    failed: "bg-red-500/20 text-red-300 border-red-500/30",
    missing_key: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    missing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    degraded: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    never: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  const c = colors[status] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === "ok" || status === "active" || status === "connected"
          ? "bg-emerald-400"
          : status === "error" || status === "failed"
          ? "bg-red-400"
          : status === "never" || status === "missing" || status === "missing_key"
          ? "bg-slate-400"
          : "bg-amber-400"
      }`} />
      {status}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#362d59] bg-[#1a1230]/80 p-5 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function MetricBlock({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="mt-1 text-2xl font-bold text-white">{value}</span>
      {sub && <span className="mt-0.5 text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OsDashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/os-dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-[#362d59]" />
          <div className="h-6 w-48 animate-pulse rounded bg-[#362d59]" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[#1a1230] border border-[#362d59]" />
          ))}
        </div>
      </div>
    );
  }

  const healthOk = data?.health.status === "ok";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#422082]">
            <svg className="h-5 w-5 text-[#c2ef4e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">OS Agent Dashboard</h2>
            <p className="text-xs text-slate-400">
              Live system overview · refreshes every 30s
              {data && <span className="ml-2 text-slate-600">({data.responseMs}ms)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={healthOk ? "ok" : "degraded"} />
          <button
            onClick={fetchDashboard}
            className="rounded-lg border border-[#362d59] bg-[#79628c]/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#79628c]/70"
            style={{ boxShadow: "rgba(0,0,0,0.1) 0px 1px 3px 0px inset" }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-300">API Error: {error}</p>
        </Card>
      )}

      {/* Health bar */}
      {data && (
        <div className="flex flex-wrap gap-2">
          {data.health.checks.map((check) => (
            <div
              key={check.name}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                check.ok
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${check.ok ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
              <span className="font-medium">{check.name}</span>
              {check.ms >= 0 && <span className="text-slate-500">{check.ms}ms</span>}
            </div>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <MetricBlock
            label="Composio Active"
            value={data?.composio.activeCount ?? "—"}
            sub={`${data?.composio.connections.length ?? 0} total`}
          />
        </Card>
        <Card>
          <MetricBlock
            label="Scheduled Posts"
            value={data?.scheduled.queued ?? "—"}
            sub={`${data?.scheduled.published ?? 0} published · ${data?.scheduled.failed ?? 0} failed`}
          />
        </Card>
        <Card>
          <MetricBlock
            label="Content Items"
            value={data?.content.total ?? "—"}
            sub={`${data?.content.published ?? 0} published · ${data?.content.draft ?? 0} draft`}
          />
        </Card>
        <Card>
          <MetricBlock
            label="Integrations"
            value={data?.integrations.length ?? "—"}
            sub={data?.integrations.join(", ") || "none configured"}
          />
        </Card>
      </div>

      {/* Two-column: Cron + Connections */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Hermes Cron Jobs */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Hermes Cron Jobs
            </h3>
            <span className="rounded bg-[#c2ef4e]/10 px-2 py-0.5 text-[11px] font-bold text-[#c2ef4e]">
              {HERMES_CRON.length} jobs
            </span>
          </div>
          <div className="space-y-2">
            {HERMES_CRON.map((job) => (
              <div
                key={job.name}
                className="flex items-center justify-between rounded-lg border border-[#362d59]/50 bg-[#150f23]/60 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-white">{job.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {job.schedule} · next: {job.nextRun}
                  </p>
                </div>
                <StatusBadge status={job.lastStatus} />
              </div>
            ))}
          </div>
        </Card>

        {/* Composio Connections */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Composio Connections
            </h3>
            {data && (
              <span className="rounded bg-[#c2ef4e]/10 px-2 py-0.5 text-[11px] font-bold text-[#c2ef4e]">
                {data.composio.activeCount} active
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {data?.composio.connections.length ? (
              data.composio.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-[#362d59]/50 bg-[#150f23]/60 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white capitalize">
                      {conn.platform.replace(/_/g, " ")}
                    </p>
                    {conn.lastAuthenticated && (
                      <p className="text-[11px] text-slate-500">
                        {new Date(conn.lastAuthenticated).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={conn.status} />
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                {loading ? "Loading connections..." : "No connections found or Composio key not set"}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Platform status row */}
      <Card>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">
          Platform Status
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(data?.platformStatus || []).map((p) => (
            <div
              key={p.name}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                p.status === "active"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-amber-500/20 bg-amber-500/5"
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{p.name}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-lg border border-[#362d59]/30 bg-[#150f23]/40 px-4 py-3">
        <p className="text-xs text-slate-500">
          Data from Composio API · Supabase DB · Hermes Cron
        </p>
        <p className="text-xs text-slate-600">
          {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "—"}
        </p>
      </div>
    </div>
  );
}

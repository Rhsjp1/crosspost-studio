"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const AUDIT_TYPES = [
  {
    id: "seo",
    name: "SEO Analysis",
    description: "Technical SEO, on-page elements, content quality, social/rich snippets, and local SEO.",
    icon: "🔍",
  },
  {
    id: "accessibility",
    name: "Accessibility Check",
    description: "HTML structure, image alt text, ARIA labels, keyboard navigation, heading hierarchy, and WCAG color contrast.",
    icon: "♿",
  },
  {
    id: "performance",
    name: "Performance",
    description: "Core Web Vitals (LCP proxy), resource analysis, caching/compression, and mobile-friendliness.",
    icon: "⚡",
  },
  {
    id: "security",
    name: "Security Headers",
    description: "HTTPS/HSTS, Content-Security-Policy, clickjacking protection, referrer policy, and information disclosure.",
    icon: "🔒",
  },
  {
    id: "links",
    name: "Link Audit",
    description: "External backlink profile, internal link architecture, broken link indicators, and link quality.",
    icon: "🌐",
  },
];

type AuditRun = {
  id: string;
  type: string;
  url: string;
  score: number;
  findings: string;
  result: string;
  notes: string | null;
  createdAt: string;
};

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type FindingStatus = "pass" | "warn" | "fail" | "info";

interface StructuredFinding {
  category: string;
  status: FindingStatus;
  message: string;
}

function parseFindings(findings: string): StructuredFinding[] {
  try {
    const parsed = JSON.parse(findings);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f: unknown) => {
      if (typeof f === "string") {
        return { category: "General", status: "info" as FindingStatus, message: f };
      }
      const obj = f as Record<string, unknown>;
      return {
        category: (obj.category as string) || "General",
        status: (obj.status as FindingStatus) || "info",
        message: (obj.message as string) || "",
      };
    });
  } catch {
    return [];
  }
}

const STATUS_ICON: Record<FindingStatus, string> = {
  pass: "\u2705",
  warn: "\u26A0\uFE0F",
  fail: "\u274C",
  info: "\u2139\uFE0F",
};

const STATUS_COLOR: Record<FindingStatus, string> = {
  pass: "text-green-400",
  warn: "text-yellow-400",
  fail: "text-red-400",
  info: "text-blue-400",
};

function groupFindings(findings: StructuredFinding[]): Record<string, StructuredFinding[]> {
  const groups: Record<string, StructuredFinding[]> = {};
  for (const f of findings) {
    if (!groups[f.category]) groups[f.category] = [];
    groups[f.category].push(f);
  }
  return groups;
}

function downloadReport(run: AuditRun) {
  const report = {
    id: run.id,
    type: run.type,
    url: run.url,
    score: run.score,
    findings: parseFindings(run.findings),
    notes: run.notes,
    ranAt: run.createdAt,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `audit-${run.type}-${run.id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function AuditHistoryRow({ run }: { run: AuditRun }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(run.notes ?? "");
  const [saved, setSaved] = useState(true);
  const queryClient = useQueryClient();

  const saveNotes = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/audits/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notes");
      return data;
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const deleteRun = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/audits/${run.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const findings = parseFindings(run.findings);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`badge ${
                run.score >= 80
                  ? "badge-success"
                  : run.score >= 50
                  ? "badge-warning"
                  : "badge-danger"
              }`}
            >
              {run.score}
            </span>
            <span className="text-sm font-medium capitalize">{run.type}</span>
            <span className="truncate text-xs text-gray-500">{run.url}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Hide" : "View"}
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={() => downloadReport(run)}
          >
            Download
          </button>
          <button
            className="text-xs text-red-400 hover:text-red-300"
            onClick={() => {
              if (confirm("Delete this audit report permanently?")) {
                deleteRun.mutate();
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-gray-700/50 pt-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Findings ({findings.length})
            </p>
            {findings.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupFindings(findings)).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="mb-1 text-xs font-semibold text-gray-300">{cat}</p>
                    <ul className="space-y-1 text-sm">
                      {items.map((f, i) => (
                        <li key={i} className={`flex items-start gap-2 ${STATUS_COLOR[f.status]}`}>
                          <span className="shrink-0">{STATUS_ICON[f.status]}</span>
                          <span className="text-gray-300">{f.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No findings recorded.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder="Add your own notes about this audit..."
              rows={3}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              className="btn-primary mt-2 text-xs disabled:opacity-50"
              disabled={saved || saveNotes.isPending}
              onClick={() => saveNotes.mutate()}
            >
              {saveNotes.isPending ? "Saving..." : saved ? "Saved" : "Save Notes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditsSection() {
  const [url, setUrl] = useState("");
  const [runningType, setRunningType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => fetch("/api/audits").then((r) => r.json()),
  });

  const auditRuns: AuditRun[] = Array.isArray(response)
    ? response
    : response?.data ?? [];

  const runAudit = useMutation({
    mutationFn: async ({ type, url: targetUrl }: { type: string; url: string }) => {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url: normalizeUrl(targetUrl) }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details
          ? Object.values(data.details.fieldErrors ?? {}).flat().join(", ")
          : "";
        throw new Error(detail ? `${data.error}: ${detail}` : data.error || "Audit failed");
      }
      return data;
    },
    onMutate: (vars) => setRunningType(vars.type),
    onSettled: () => setRunningType(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleRun = (typeId: string) => {
    if (!url.trim()) {
      alert("Enter a URL to audit first.");
      return;
    }
    runAudit.mutate({ type: typeId, url });
  };

  const latestByType = (typeId: string) =>
    auditRuns.find((r) => r.type === typeId);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Audits</h1>

      <div className="card">
        <label className="mb-2 block text-sm font-medium text-gray-300">
          Site URL to audit
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com or https://example.com"
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          https:// will be added automatically if you leave it out.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AUDIT_TYPES.map((audit) => {
          const latestRun = latestByType(audit.id);
          const isRunning = runningType === audit.id;

          return (
            <div key={audit.id} className="card">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{audit.icon}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{audit.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{audit.description}</p>
                  {latestRun && (
                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className={`badge ${
                          latestRun.score >= 80
                            ? "badge-success"
                            : latestRun.score >= 50
                            ? "badge-warning"
                            : "badge-danger"
                        }`}
                      >
                        Score: {latestRun.score}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(latestRun.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                className="btn-primary mt-4 w-full text-sm disabled:opacity-50"
                disabled={isRunning || !url.trim()}
                onClick={() => handleRun(audit.id)}
              >
                {isRunning ? "Running..." : "Run Audit"}
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Audit History</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-20 w-full" />
            ))}
          </div>
        ) : auditRuns.length > 0 ? (
          <div className="space-y-3">
            {auditRuns.map((run) => (
              <AuditHistoryRow key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-gray-400">No audits run yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Run your first audit above — every report is saved here permanently.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditsSection;

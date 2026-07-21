"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const AUDIT_TYPES = [
  {
    id: "seo",
    name: "SEO Analysis",
    description: "Analyze meta tags, heading structure, keyword density, and search readiness.",
    icon: "🔍",
  },
  {
    id: "accessibility",
    name: "Accessibility Check",
    description: "Review alt attributes, ARIA labels, and form label usage.",
    icon: "♿",
  },
  {
    id: "performance",
    name: "Performance",
    description: "Measure page load time and response speed.",
    icon: "⚡",
  },
  {
    id: "security",
    name: "Security Headers",
    description: "Check for CSP, X-Frame-Options, and HTTPS usage.",
    icon: "🔒",
  },
  {
    id: "links",
    name: "Link Audit",
    description: "Count outbound links and unique linked domains.",
    icon: "🌐",
  },
];

function AuditsSection() {
  const [url, setUrl] = useState("");
  const [runningType, setRunningType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => fetch("/api/audits").then((r) => r.json()),
  });

  // Backend returns { data: items } — unwrap safely, tolerate a raw array too.
  const auditRuns: Array<{
    id: string;
    type: string;
    score: number;
    createdAt: string;
    url: string;
  }> = Array.isArray(response) ? response : response?.data ?? [];

  const runAudit = useMutation({
    mutationFn: async ({ type, url: targetUrl }: { type: string; url: string }) => {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audit failed");
      return data;
    },
    onMutate: (vars) => setRunningType(vars.type),
    onSettled: () => setRunningType(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const handleRun = (typeId: string) => {
    if (!url.trim()) {
      alert("Enter a URL to audit first.");
      return;
    }
    runAudit.mutate({ type: typeId, url: url.trim() });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audits</h1>

      <div className="card">
        <label className="mb-2 block text-sm font-medium text-gray-300">
          Site URL to audit
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AUDIT_TYPES.map((audit) => {
          const latestRun = auditRuns.find((r) => r.type === audit.id);
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

      {isLoading && (
        <p className="text-sm text-gray-500">Loading past audit results...</p>
      )}
    </div>
  );
}

export default AuditsSection;

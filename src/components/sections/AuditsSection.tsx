"use client";

import { useQuery } from "@tanstack/react-query";


const AUDIT_TYPES = [
  {
    id: "website_check",
    name: "Website Check",
    description: "Verify website uptime, SSL certificate, page load speed, and broken links.",
    icon: "🌐",
  },
  {
    id: "seo_analysis",
    name: "SEO Analysis",
    description: "Analyze meta tags, heading structure, keyword density, and search readiness.",
    icon: "🔍",
  },
  {
    id: "content_quality",
    name: "Content Quality",
    description: "Evaluate readability, grammar, tone consistency, and engagement potential.",
    icon: "✍️",
  },
  {
    id: "social_media",
    name: "Social Media Audit",
    description: "Review social profiles, posting frequency, engagement metrics, and consistency.",
    icon: "📱",
  },
];

function AuditsSection() {
  const { data: auditRuns = [], isLoading } = useQuery({
    queryKey: ["audits"],
    queryFn: () => fetch("/api/audits").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audits</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {AUDIT_TYPES.map((audit) => {
          const latestRun = Array.isArray(auditRuns)
            ? auditRuns.find((r: { type: string }) => r.type === audit.id)
            : null;

          return (
            <div key={audit.id} className="card">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{audit.icon}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{audit.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{audit.description}</p>
                  {latestRun && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className={`badge ${latestRun.score >= 80 ? "badge-success" : latestRun.score >= 50 ? "badge-warning" : "badge-danger"}`}>
                        Score: {latestRun.score}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(latestRun.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button className="btn-primary mt-4 w-full text-sm">
                Run Audit
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuditsSection;

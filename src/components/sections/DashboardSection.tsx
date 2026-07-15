"use client";

import { useQuery } from "@tanstack/react-query";

export default function DashboardSection() {
  const { data: content = [], isLoading: contentLoading } = useQuery({
    queryKey: ["content"],
    queryFn: () => fetch("/api/content").then((r) => r.json()),
  });

  const { data: scheduled = [], isLoading: scheduledLoading } = useQuery({
    queryKey: ["scheduled"],
    queryFn: () => fetch("/api/scheduled").then((r) => r.json()),
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetch("/api/connections").then((r) => r.json()),
  });

  const { data: syncs = [], isLoading: syncsLoading } = useQuery({
    queryKey: ["ghl-syncs"],
    queryFn: () => fetch("/api/ghl-sync").then((r) => r.json()),
  });

  const totalContent = Array.isArray(content) ? content.length : 0;
  const approved = Array.isArray(content) ? content.filter((c: { status: string }) => c.status === "approved").length : 0;
  const queued = Array.isArray(scheduled) ? scheduled.filter((s: { status: string }) => s.status === "queued").length : 0;
  const aiGenerated = Array.isArray(content) ? content.filter((c: { contentType: string }) => c.contentType === "ai_generated").length : 0;
  const published = Array.isArray(scheduled) ? scheduled.filter((s: { status: string }) => s.status === "published").length : 0;
  const pendingReview = Array.isArray(content) ? content.filter((c: { status: string }) => c.status === "pending_review").length : 0;
  const totalConnections = Array.isArray(connections) ? connections.filter((c: { status: string }) => c.status === "connected").length : 0;
  const totalSyncs = Array.isArray(syncs) ? syncs.length : 0;

  const stats = [
    { label: "Total Content", value: contentLoading ? "—" : totalContent, color: "text-blue-400" },
    { label: "Approved", value: contentLoading ? "—" : approved, color: "text-green-400" },
    { label: "Queued", value: scheduledLoading ? "—" : queued, color: "text-yellow-400" },
    { label: "AI Generated", value: contentLoading ? "—" : aiGenerated, color: "text-purple-400" },
    { label: "Connections", value: connectionsLoading ? "—" : totalConnections, color: "text-blue-400" },
    { label: "Published", value: scheduledLoading ? "—" : published, color: "text-green-400" },
    { label: "Pending Review", value: contentLoading ? "—" : pendingReview, color: "text-orange-400" },
    { label: "CRM Syncs", value: syncsLoading ? "—" : totalSyncs, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-sm text-gray-400">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Recent Content</h2>
        {contentLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : Array.isArray(content) && content.length > 0 ? (
          <div className="space-y-2">
            {content.slice(0, 5).map((item: { id: string; title: string; status: string; contentType: string }) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.contentType}</p>
                </div>
                <span className={`badge ${item.status === "approved" ? "badge-success" : item.status === "draft" ? "badge-warning" : "badge-primary"}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No content yet. Create your first content item to get started.</p>
        )}
      </div>
    </div>
  );
}

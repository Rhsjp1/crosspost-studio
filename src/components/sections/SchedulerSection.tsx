"use client";

import { useQuery } from "@tanstack/react-query";

export default function SchedulerSection() {
  const { data: response, isLoading } = useQuery({
    queryKey: ["scheduled"],
    queryFn: () => fetch("/api/scheduled").then((r) => r.json()),
  });
  const scheduled = Array.isArray(response) ? response : response?.data ?? [];

  const byDate: Record<string, typeof scheduled> = {};
  for (const post of scheduled) {
    const dateKey = new Date(post.scheduledFor).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(post);

  }

  const dateKeys = Object.keys(byDate).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduler</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : dateKeys.length > 0 ? (
        <div className="space-y-6">
          {dateKeys.map((dateKey) => (
            <div key={dateKey}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">{dateKey}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {byDate[dateKey].map((post: { id: string; platform: string; status: string; scheduledFor: string }) => (
                  <div key={post.id} className="card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{post.platform}</span>
                      <span className={`badge ${post.status === "published" ? "badge-success" : post.status === "queued" ? "badge-warning" : "badge-primary"}`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {new Date(post.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-400">No scheduled posts.</p>
          <p className="mt-1 text-sm text-gray-500">Create content and schedule it to platforms.</p>
        </div>
      )}
    </div>
  );
}

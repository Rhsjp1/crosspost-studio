"use client";

import { useQuery } from "@tanstack/react-query";

export default function ApprovalsSection() {
  const { data: contentRes, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: () => fetch("/api/content").then((r) => r.json()),
  });
  const content = Array.isArray(contentRes) ? contentRes : contentRes?.data ?? [];

  const pendingItems = Array.isArray(content)
    ? content.filter((c: { status: string }) => c.status === "pending_review")
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <span className="badge badge-warning">{pendingItems.length} pending</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : pendingItems.length > 0 ? (
        <div className="space-y-3">
          {pendingItems.map((item: { id: string; title: string; body: string; contentType: string }) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-400 line-clamp-2">{item.body}</p>
                  <span className="mt-2 inline-block badge badge-primary">{item.contentType}</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-sm">Approve</button>
                  <button className="btn-secondary text-sm">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-400">No items pending approval.</p>
          <p className="mt-1 text-sm text-gray-500">All content has been reviewed.</p>
        </div>
      )}
    </div>
  );
}

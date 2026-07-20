"use client";

import { useQuery } from "@tanstack/react-query";


export default function HistorySection() {
  const { data: eventsRes, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetch("/api/history").then((r) => r.json()),
  });
  const events = Array.isArray(eventsRes) ? eventsRes : eventsRes?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : Array.isArray(events) && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event: { id: string; action: string; platform: string | null; details: string | null; createdAt: string }) => (
            <div key={event.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium capitalize">{event.action.replace(/_/g, " ")}</p>
                <div className="mt-1 flex gap-2">
                  {event.platform && (
                    <span className="badge badge-primary">{event.platform}</span>
                  )}
                  {event.details && (
                    <span className="text-xs text-gray-400">
                      {typeof event.details === "string"
                        ? JSON.parse(event.details)?.title || event.details
                        : event.details}
                    </span>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-xs text-gray-500">
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-400">No history events yet.</p>
          <p className="mt-1 text-sm text-gray-500">Events will appear as you create and manage content.</p>
        </div>
      )}
    </div>
  );
}

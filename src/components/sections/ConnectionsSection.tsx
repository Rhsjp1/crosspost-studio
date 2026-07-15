"use client";

import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";

const useStore = create<{ setActiveSection: (s: string) => void }>((set) => ({
  setActiveSection: (section) => set({}),
}));


const PLATFORMS = [
  { id: "facebook", name: "Facebook", color: "#1877F2", provider: "composio" },
  { id: "instagram", name: "Instagram", color: "#E4405F", provider: "composio" },
  { id: "twitter", name: "Twitter / X", color: "#1DA1F2", provider: "composio" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", provider: "composio" },
  { id: "youtube", name: "YouTube", color: "#FF0000", provider: "composio" },
  { id: "tiktok", name: "TikTok", color: "#000000", provider: "composio" },
  { id: "google_business", name: "Google Business Profile", color: "#4285F4", provider: "ghl" },
  { id: "pinterest", name: "Pinterest", color: "#E60023", provider: "native" },
];

function ConnectionsSection() {
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => fetch("/api/connections").then((r) => r.json()),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const hasApiKey = settings?.COMPOSIO_API_KEY;

  // Group connections by platform (multiple allowed)
  const connectionsByPlatform: Record<string, (typeof connections)[number][]> = {};
  for (const c of connections) {
    if (!connectionsByPlatform[c.platform]) connectionsByPlatform[c.platform] = [];
    connectionsByPlatform[c.platform].push(c);
  }

  const handleConnect = async (platformId: string, label?: string) => {
    // Requires userId from session — use placeholder for now
    const userId = "default";
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: platformId, userId, label }),
    });
    const data = await res.json();
    if (data.redirectUrl) window.open(data.redirectUrl, "_blank", "width=600,height=700");
    else alert(data.error || "Connection failed");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Connections</h1>
        {!hasApiKey && (
          <button
            onClick={() => useStore.getState().setActiveSection("settings")}
            className="btn-secondary text-sm"
          >
            Configure API Key
          </button>
        )}
      </div>

      {!hasApiKey && (
        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm text-yellow-400">
            Composio API key is not configured. Connect platforms by setting your API key in Settings first.
          </p>
        </div>
      )}

      <div className="platform-grid">
        {PLATFORMS.map((platform) => {
          const conns = connectionsByPlatform[platform.id] || [];
          const anyConnected = conns.some((c) => c.status === "connected" || c.status === "ACTIVE");

          return (
            <div key={platform.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: platform.color }}
                  >
                    {platform.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{platform.name}</p>
                    {conns.length > 0 && (
                      <p className="text-xs text-gray-400">{conns.length} account{conns.length > 1 ? "s" : ""}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {anyConnected ? (
                    <span className="badge badge-success">{conns.length} Connected</span>
                  ) : (
                    <button
                      className="btn-secondary text-xs"
                      disabled={!hasApiKey && platform.provider === "composio"}
                      onClick={() => handleConnect(platform.id)}
                      title={
                        !hasApiKey && platform.provider === "composio"
                          ? "Configure API key in Settings first"
                          : platform.provider === "ghl"
                          ? "Connect via GoHighLevel"
                          : platform.provider === "native"
                          ? "Coming soon"
                          : `Connect ${platform.name}`
                      }
                    >
                      {!hasApiKey && platform.provider === "composio"
                        ? "Setup Required"
                        : platform.provider === "ghl"
                        ? "GHL Connect"
                        : platform.provider === "native"
                        ? "Coming Soon"
                        : "Connect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Show individual account rows */}
              {conns.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-gray-700/50 pt-3">
                  {conns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 truncate">
                        {c.label || c.accountName || c.accountId?.slice(-6) || "Unknown"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${c.status === "connected" || c.status === "ACTIVE" ? "badge-success" : c.status === "initializing" ? "badge-warn" : "badge-muted"}`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add another account button when already has connections */}
              {conns.length > 0 && platform.provider === "composio" && hasApiKey && (
                <button
                  className="mt-2 text-xs text-gray-400 hover:text-white underline"
                  onClick={() => {
                    const label = prompt(`Label for new ${platform.name} account:`);
                    if (label) handleConnect(platform.id, label);
                  }}
                >
                  + Add another account
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConnectionsSection;

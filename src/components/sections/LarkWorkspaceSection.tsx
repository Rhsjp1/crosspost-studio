"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

/*  Section: Lark Workspace                                           */
/* ------------------------------------------------------------------ */

function LarkWorkspaceSection() {
  const { data: status, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ["lark-status"],
    queryFn: () => fetch("/api/lark").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const [activeTab, setActiveTab] = React.useState<"calendar" | "mail" | "messages" | "docs" | "tasks">("calendar");
  const [command, setCommand] = React.useState("");
  const [cmdOutput, setCmdOutput] = React.useState<Record<string, unknown> | null>(null);
  const [cmdLoading, setCmdLoading] = React.useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    setCmdLoading(true);
    setCmdOutput(null);
    try {
      const [cmd, ...args] = command.trim().split(/\s+/);
      const res = await fetch("/api/lark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, args }),
      });
      const data = await res.json();
      setCmdOutput(data);
    } catch (e) {
      setCmdOutput({ error: String(e) });
    } finally {
      setCmdLoading(false);
    }
  };

  const isConnected = status?.output?.ok !== false;
  const larkUser = status?.output?.identity || status?.output?.app;

  const tabConfig = [
    { id: "calendar" as const, label: "Calendar", icon: "📅" },
    { id: "mail" as const, label: "Mail", icon: "📧" },
    { id: "messages" as const, label: "Messages", icon: "💬" },
    { id: "docs" as const, label: "Docs", icon: "📄" },
    { id: "tasks" as const, label: "Tasks", icon: "✅" },
  ];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`card flex items-center gap-4 ${isConnected ? "border-green-800" : "border-red-800"}`}>
        <div className={`h-3 w-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {statusLoading ? "Checking..." : isConnected ? "Lark Connected" : "Lark Not Connected"}
          </h3>
          <p className="text-sm text-gray-400">
            {larkUser ? `Identity: ${JSON.stringify(larkUser).substring(0, 80)}` : "Run lark-cli config init to connect"}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">Refresh</button>
      </div>

      {/* Quick Command Runner */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Quick Command</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCommand()}
            placeholder="e.g. calendar +agenda, mail user_mailbox.messages list"
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={runCommand} disabled={cmdLoading || !command.trim()} className="btn-primary">
            {cmdLoading ? "Running..." : "Run"}
          </button>
        </div>
        {cmdOutput && (
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
            {JSON.stringify(cmdOutput, null, 2)}
          </pre>
        )}
      </div>

      {/* Domain Tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-1">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-800 text-indigo-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <LarkTabContent tab={activeTab} />
    </div>
  );
}

function LarkTabContent({ tab }: { tab: "calendar" | "mail" | "messages" | "docs" | "tasks" }) {
  const [formData, setFormData] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [listData, setListData] = React.useState<Record<string, unknown> | null>(null);

  const tabMeta: Record<string, { endpoint: string; fields: { key: string; label: string; type?: string }[]; listLabel: string }> = {
    calendar: {
      endpoint: "/api/lark/calendar",
      listLabel: "Agenda & Events",
      fields: [
        { key: "title", label: "Event Title" },
        { key: "startTime", label: "Start Time", type: "datetime-local" },
        { key: "endTime", label: "End Time", type: "datetime-local" },
        { key: "attendees", label: "Attendee IDs (comma separated)" },
      ],
    },
    mail: {
      endpoint: "/api/lark/mail",
      listLabel: "Unread Emails",
      fields: [
        { key: "to", label: "To (email)" },
        { key: "subject", label: "Subject" },
        { key: "body", label: "Body", type: "textarea" },
      ],
    },
    messages: {
      endpoint: "/api/lark/messages",
      listLabel: "Recent Messages",
      fields: [
        { key: "chatId", label: "Chat ID" },
        { key: "text", label: "Message", type: "textarea" },
      ],
    },
    docs: {
      endpoint: "/api/lark/docs",
      listLabel: "Recent Documents",
      fields: [
        { key: "title", label: "Doc Title" },
        { key: "content", label: "Content", type: "textarea" },
        { key: "folderToken", label: "Folder Token (optional)" },
      ],
    },
    tasks: {
      endpoint: "/api/lark/tasks",
      listLabel: "Tasks",
      fields: [
        { key: "title", label: "Task Title" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "dueDate", label: "Due Date", type: "datetime-local" },
      ],
    },
  };

  const meta = tabMeta[tab];

  React.useEffect(() => {
    setLoading(true);
    fetch(meta.endpoint)
      .then((r) => r.json())
      .then(setListData)
      .catch(() => setListData({ error: "Failed to fetch" }))
      .finally(() => setLoading(false));
  }, [tab, meta.endpoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(meta.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setResult(data);
      if (data.output) {
        setListData(data);
      }
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* List Panel */}
      <div className="card">
        <h3 className="mb-3 font-semibold">{meta.listLabel}</h3>
        {loading && !listData ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : listData?.error ? (
          <p className="text-sm text-red-400">{JSON.stringify(listData.error)}</p>
        ) : (
          <pre className="max-h-96 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
            {JSON.stringify(listData, null, 2)}
          </pre>
        )}
      </div>

      {/* Create Form */}
      <div className="card">
        <h3 className="mb-3 font-semibold">Create New</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {meta.fields.map((f) =>
            f.type === "textarea" ? (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-400">{f.label}</label>
                <textarea
                  value={formData[f.key] || ""}
                  onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                  rows={3}
                />
              </div>
            ) : (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-400">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={formData[f.key] || ""}
                  onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Processing..." : "Submit"}
          </button>
        </form>
        {result && (
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default LarkWorkspaceSection;

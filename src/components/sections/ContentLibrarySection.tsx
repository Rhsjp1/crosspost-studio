"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function ContentLibrarySection() {
  const { data: contentRes, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: () => fetch("/api/content").then((r) => r.json()),
  });
  const content = Array.isArray(contentRes) ? contentRes : contentRes?.data ?? [];

  const queryClient = useQueryClient();
  const [showBulk, setShowBulk] = useState(false);

  const bulkMutation = useMutation({
    mutationFn: (items: { title: string; body: string; tone?: string; contentType?: string; status?: string }[]) =>
      fetch("/api/content/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      setShowBulk(false);
    },
  });

  const [bulkText, setBulkText] = useState("");
  const [bulkTone, setBulkTone] = useState("professional");
  const [bulkType, setBulkType] = useState("social_post");
  const [bulkStatus, setBulkStatus] = useState("draft");

  const handleBulkImport = () => {
    // Parse: split by double newline (blank line between items)
    // First line of each block = title, rest = body
    const blocks = bulkText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    if (blocks.length === 0) return;

    const items = blocks.map((block) => {
      const lines = block.split("\n");
      const title = lines[0].trim() || "Untitled";
      const body = lines.slice(1).join("\n").trim() || title;
      return {
        title,
        body,
        tone: bulkTone,
        contentType: bulkType,
        status: bulkStatus,
      };
    });

    bulkMutation.mutate(items);
  };

  const parsedCount = bulkText
    .split(/\n\s*\n/)
    .filter((b) => b.trim().length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <UploadIcon /> Bulk Import
          </button>
          <button className="btn-primary inline-flex items-center gap-2">
            <PlusIcon /> Create Content
          </button>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulk && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bulk Import Content</h2>
            <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-white">
              <CloseIcon />
            </button>
          </div>

          <p className="text-sm text-gray-400">
            Paste content below. Separate each item with a blank line. The first line of each block becomes the title; the rest becomes the body.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Tone</label>
              <select
                value={bulkTone}
                onChange={(e) => setBulkTone(e.target.value)}
                className="input w-full"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="persuasive">Persuasive</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Content Type</label>
              <select
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value)}
                className="input w-full"
              >
                <option value="social_post">Social Post</option>
                <option value="blog">Blog</option>
                <option value="email">Email</option>
                <option value="ad_copy">Ad Copy</option>
                <option value="video_script">Video Script</option>
                <option value="landing_page">Landing Page</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Status</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="input w-full"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`First Post Title\nThis is the body of the first post.\n\nSecond Post Title\nThis is the body of the second post.\n\nThird Post Title\nBody content here...`}
            className="input min-h-[300px] w-full font-mono text-sm"
            rows={12}
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {parsedCount} item{parsedCount !== 1 ? "s" : ""} detected
            </span>
            <button
              onClick={handleBulkImport}
              disabled={bulkMutation.isPending || parsedCount === 0}
              className="btn-primary inline-flex items-center gap-2"
            >
              {bulkMutation.isPending ? "Importing..." : `Import ${parsedCount} Item${parsedCount !== 1 ? "s" : ""}`}
            </button>
          </div>

          {bulkMutation.isError && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {(bulkMutation.error as { error?: string })?.error || "Import failed"}
            </div>
          )}

          {bulkMutation.isSuccess && (
            <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
              Successfully imported {bulkMutation.data?.count} items.
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : Array.isArray(content) && content.length > 0 ? (
        <div className="space-y-3">
          {content.map((item: { id: string; title: string; body: string; status: string; contentType: string; tone: string; createdAt: string }) => (
            <div key={item.id} className="card flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 truncate text-sm text-gray-400">{item.body}</p>
                <div className="mt-2 flex gap-2">
                  <span className={`badge ${item.status === "approved" ? "badge-success" : item.status === "draft" ? "badge-warning" : "badge-primary"}`}>
                    {item.status}
                  </span>
                  <span className="badge badge-primary">{item.contentType}</span>
                  <span className="badge">{item.tone}</span>
                </div>
              </div>
              <p className="shrink-0 text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-400">No content items yet.</p>
          <p className="mt-1 text-sm text-gray-500">Click &quot;Bulk Import&quot; to paste multiple items or &quot;Create Content&quot; to add one.</p>
        </div>
      )}
    </div>
  );
}

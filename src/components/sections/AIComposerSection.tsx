"use client";

import { useState, useCallback } from "react";

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

export default function AIComposerSection() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [contentType, setContentType] = useState("social_post");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedContent("");
    try {
      const res = await fetch("/api/composer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tone, contentType }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedContent(data.body || data.content || data.result || "Content generated successfully but no body returned.");
      } else {
        setGeneratedContent(`Generation failed (${res.status}). Check the Composer API route.`);
      }
    } catch {
      setGeneratedContent("Failed to connect to the API. Make sure the server is running.");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, tone, contentType]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Composer</h1>

      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Prompt / Topic</label>
          <textarea
            className="input-field min-h-[120px] resize-y"
            placeholder="Describe the content you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Tone</label>
            <select
              className="input-field"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="authoritative">Authoritative</option>
              <option value="humorous">Humorous</option>
              <option value="inspirational">Inspirational</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Content Type</label>
            <select
              className="input-field"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
              <option value="social_post">Social Post</option>
              <option value="blog_post">Blog Post</option>
              <option value="email">Email</option>
              <option value="ad_copy">Ad Copy</option>
              <option value="video_script">Video Script</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon />
          {isGenerating ? "Generating..." : "Generate Content"}
        </button>
      </div>

      {generatedContent && (
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Generated Output</h2>
          <div className="rounded-lg bg-gray-800/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-300">
            {generatedContent}
          </div>
        </div>
      )}
    </div>
  );
}

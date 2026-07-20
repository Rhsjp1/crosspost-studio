"use client";

import { useState, useCallback } from "react";

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const CONTENT_CATEGORIES = [
  { id: "hooks-problem", label: "Hooks", sublabel: "Problem", icon: "🪝" },
  { id: "hooks-result", label: "Hooks", sublabel: "Result", icon: "🎯" },
  { id: "hooks-mistake", label: "Hooks", sublabel: "Mistake", icon: "⚠️" },
  { id: "hooks-curiosity", label: "Hooks", sublabel: "Curiosity", icon: "🤔" },
  { id: "scripts", label: "Scripts", sublabel: "", icon: "📝" },
  { id: "captions", label: "Captions", sublabel: "", icon: "💬" },
  { id: "landing-pages", label: "Landing Pages", sublabel: "", icon: "🌐" },
  { id: "emails", label: "Emails", sublabel: "", icon: "📧" },
];

const ENGINE_PLATFORMS = [
  { id: "tiktok", label: "TikTok", color: "#000000" },
  { id: "instagram", label: "Instagram", color: "#E4405F" },
  { id: "youtube", label: "YouTube", color: "#FF0000" },
  { id: "generic", label: "Generic", color: "#6B7280" },
];

interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  platform: string;
  body: string;
  variables: string[];
}

function ContentEngineSection() {
  const [activeCategory, setActiveCategory] = useState("hooks-problem");
  const [activePlatform, setActivePlatform] = useState("tiktok");
  const [templates, setTemplates] = useState<ContentTemplate[]>([
    { id: "tpl-1", name: "Pain Point Hook", category: "hooks-problem", platform: "tiktok", body: "Stop doing {{mistake}} if you want to {{desired_result}}. Here's what nobody tells you about {{topic}}...", variables: ["mistake", "desired_result", "topic"] },
    { id: "tpl-2", name: "Result Hook", category: "hooks-result", platform: "instagram", body: "I went from {{before_state}} to {{after_state}} in just {{timeframe}}. Here's exactly how...", variables: ["before_state", "after_state", "timeframe"] },
    { id: "tpl-3", name: "Curiosity Hook", category: "hooks-curiosity", platform: "youtube", body: "The #1 thing holding you back from {{goal}} is probably not what you think. Most people focus on {{wrong_thing}} when they should be focusing on...", variables: ["goal", "wrong_thing"] },
    { id: "tpl-4", name: "Mistake Hook", category: "hooks-mistake", platform: "tiktok", body: "I can't believe I spent {{time_wasted}} doing {{bad_action}} before I discovered this {{solution}}...", variables: ["time_wasted", "bad_action", "solution"] },
  ]);
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [competitorAccounts, setCompetitorAccounts] = useState("");
  const [frameworkAnalysis, setFrameworkAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filteredTemplates = templates.filter(
    (t) => t.category === activeCategory && (activePlatform === "generic" || t.platform === activePlatform || t.platform === "generic")
  );

  const handleCreateTemplate = () => {
    const newTemplate: ContentTemplate = {
      id: `tpl-${Date.now()}`,
      name: "New Template",
      category: activeCategory,
      platform: activePlatform,
      body: "Create content about {{topic}} that {{action}}...",
      variables: ["topic", "action"],
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setEditingTemplate(newTemplate);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)));
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingTemplate?.id === id) setEditingTemplate(null);
  };

  const handleGenerateContent = useCallback(async () => {
    const activeTpl = filteredTemplates[0];
    if (!activeTpl) return;
    setIsGenerating(true);
    setGeneratedContent("");
    try {
      const res = await fetch("/api/composer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activeTpl.body,
          tone: "professional",
          contentType: "social_post",
          variables: variableValues,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        let result = data.body || data.content || "";
        for (const [key, value] of Object.entries(variableValues)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
        }
        setGeneratedContent(result || "Content generated successfully.");
      } else {
        let result = activeTpl.body;
        for (const [key, value] of Object.entries(variableValues)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
        }
        setGeneratedContent(result);
      }
    } catch {
      let result = activeTpl.body;
      for (const [key, value] of Object.entries(variableValues)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || `[${key}]`);
      }
      setGeneratedContent(result);
    } finally {
      setIsGenerating(false);
    }
  }, [filteredTemplates, variableValues]);

  const handleAnalyzeFramework = useCallback(async () => {
    const accounts = competitorAccounts
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (accounts.length === 0) return;
    setIsAnalyzing(true);
    setFrameworkAnalysis("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analyze these competitor social media accounts: ${accounts.join(", ")}. Provide a 5x5 framework analysis covering: top performing hook patterns with engagement percentages, common content themes, posting frequency, and recommended content strategy. Format as clean markdown.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFrameworkAnalysis(data.content || data.text || "Analysis unavailable.");
      } else {
        setFrameworkAnalysis("Analysis failed. Check AI configuration in Settings.");
      }
    } catch {
      setFrameworkAnalysis("Analysis failed. Check AI configuration in Settings.");
    }
    setIsAnalyzing(false);
  }, [competitorAccounts]);

  const activeTpl = filteredTemplates[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Engine</h1>
      </div>

      {/* Category filter */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Content Categories</h2>
        <div className="flex flex-wrap gap-2">
          {CONTENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {cat.sublabel && <span className="text-xs opacity-70">({cat.sublabel})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Platform filter */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Platform</h2>
        <div className="flex flex-wrap gap-2">
          {ENGINE_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                activePlatform === platform.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: platform.color }}
              />
              {platform.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template list with create/edit */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Templates</h2>
          <button onClick={handleCreateTemplate} className="btn-primary inline-flex items-center gap-2 text-sm">
            <PlusIcon /> New Template
          </button>
        </div>

        {editingTemplate ? (
          <div className="space-y-3 rounded-lg border border-indigo-500/30 bg-gray-800/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Template Name</label>
                <input
                  className="input-field"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Variables (comma-separated)</label>
                <input
                  className="input-field"
                  value={editingTemplate.variables.join(", ")}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      variables: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Template Body (use {"{{variable_name}}"})</label>
              <textarea
                className="input-field min-h-[100px] resize-y"
                value={editingTemplate.body}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveTemplate} className="btn-primary text-sm">Save</button>
              <button onClick={() => setEditingTemplate(null)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : null}

        {filteredTemplates.length > 0 ? (
          <div className="space-y-2">
            {filteredTemplates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-400">{tpl.body}</p>
                  <div className="mt-1 flex gap-1">
                    {tpl.variables.map((v) => (
                      <span key={v} className="badge badge-muted text-xs">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 ml-3">
                  <button
                    onClick={() => setEditingTemplate(tpl)}
                    className="btn-secondary text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="btn-secondary text-xs text-red-400 hover:border-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No templates for this category/platform. Create one above.</p>
        )}
      </div>

      {/* Generate content from template */}
      {activeTpl && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">Generate Content from &quot;{activeTpl.name}&quot;</h2>
          <div className="space-y-3">
            {activeTpl.variables.map((variable) => (
              <div key={variable}>
                <label className="mb-1 block text-sm font-medium text-gray-300">{`{{${variable}}}`}</label>
                <input
                  className="input-field"
                  placeholder={`Enter value for ${variable}...`}
                  value={variableValues[variable] || ""}
                  onChange={(e) => setVariableValues((prev) => ({ ...prev, [variable]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            <SendIcon />
            {isGenerating ? "Generating..." : "Generate Content"}
          </button>

          {generatedContent && (
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Generated Output</h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-300">{generatedContent}</div>
            </div>

          )}
        </div>
      )}

      {/* 5x5 Framework */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">5×5 Competitor Framework</h2>
        <p className="text-sm text-gray-400">
          Enter up to 5 competitor account handles (comma-separated) to analyze their content strategy and identify patterns.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Competitor Accounts</label>
          <input
            className="input-field"
            placeholder="e.g. @competitor1, @competitor2, @competitor3, @competitor4, @competitor5"
            value={competitorAccounts}
            onChange={(e) => setCompetitorAccounts(e.target.value)}
          />
        </div>
        <button
          onClick={handleAnalyzeFramework}
          disabled={isAnalyzing || !competitorAccounts.trim()}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Competitors"}
        </button>

        {frameworkAnalysis && (
          <div className="rounded-lg bg-gray-800/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-300">Analysis Results</h3>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-300">{frameworkAnalysis}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContentEngineSection;

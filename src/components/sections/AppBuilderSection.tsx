"use client";

import { useState, useCallback } from "react";

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}


const APP_TEMPLATES = [
  { id: "fitness", name: "Fitness Planner", description: "Workout routines, progress tracking, and goal setting for fitness enthusiasts.", prompt: "Build a fitness planner app that lets users create custom workout routines, track their daily exercises, log body measurements, set fitness goals (weight loss, muscle gain, endurance), and view progress charts over time. Include rest day recommendations and progressive overload suggestions." },
  { id: "content-planner", name: "Content Planner", description: "Plan, schedule, and organize social media content across platforms.", prompt: "Build a content planner app for social media creators that lets them plan content calendars, organize posts by platform (Instagram, TikTok, YouTube, Twitter), schedule posting times, store content ideas, and track engagement metrics. Include a content pillar system and hashtag suggestions." },
  { id: "budget", name: "Budget Tracker", description: "Personal finance management with expense categories and savings goals.", prompt: "Build a personal budget tracker app that helps users categorize expenses, set monthly budgets per category, track income vs spending, visualize spending habits with charts, set savings goals, and receive alerts when approaching budget limits. Include recurring expense management." },
  { id: "meal", name: "Meal Planner", description: "Weekly meal planning with recipes, grocery lists, and nutritional info.", prompt: "Build a meal planner app that generates weekly meal plans based on dietary preferences, creates automatic grocery lists from selected meals, stores favorite recipes with nutritional information, tracks daily calorie and macro intake, and supports meal prep scheduling for the week." },
  { id: "habit", name: "Habit Tracker", description: "Daily habit tracking with streaks, reminders, and analytics.", prompt: "Build a habit tracker app that lets users define daily habits, check them off each day, track streaks and completion rates, set reminders, view weekly/monthly analytics, celebrate milestones, and customize habit categories (health, productivity, learning, mindfulness)." },
  { id: "study", name: "Study Scheduler", description: "Organize study sessions, subjects, and revision with spaced repetition.", prompt: "Build a study scheduler app that organizes study sessions by subject, implements spaced repetition for review scheduling, tracks study hours, sets exam countdown timers, prioritizes weak areas, and generates study plans based on available time and upcoming deadlines." },
];

interface GeneratedApp {
  id: string;
  name: string;

  niche: string;
  status: "draft" | "building" | "ready" | "deployed";
  pricing: number;
  subscribers: number;
}

function AppBuilderSection() {
  const [prompt, setPrompt] = useState("");
  const [pricing, setPricing] = useState("9.99");
  const [generatedApps, setGeneratedApps] = useState<GeneratedApp[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleUseTemplate = (templatePrompt: string) => {
    setPrompt(templatePrompt);
  };

  const handleGenerateApp = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/composer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tone: "professional", contentType: "app_blueprint" }),
      });
      if (res.ok) {
        const data = await res.json();
        const appName = data.title || prompt.slice(0, 40).replace(/[^\w\s]/g, "") || "New App";
        const newApp: GeneratedApp = {
          id: `app-${Date.now()}`,
          name: appName,
          niche: APP_TEMPLATES.find((t) => prompt.includes(t.name.toLowerCase()))?.name || "Custom",
          status: "ready",
          pricing: parseFloat(pricing) || 9.99,
          subscribers: 0,
        };
        setGeneratedApps((prev) => [...prev, newApp]);
      } else {
        const newApp: GeneratedApp = {
          id: `app-${Date.now()}`,
          name: prompt.slice(0, 40).replace(/[^\w\s]/g, "") || "New App",
          niche: "Custom",
          status: "draft",
          pricing: parseFloat(pricing) || 9.99,
          subscribers: 0,
        };
        setGeneratedApps((prev) => [...prev, newApp]);
      }
    } catch {
      const newApp: GeneratedApp = {
        id: `app-${Date.now()}`,
        name: prompt.slice(0, 40).replace(/[^\w\s]/g, "") || "New App",
        niche: "Custom",
        status: "draft",
        pricing: parseFloat(pricing) || 9.99,
        subscribers: 0,
      };
      setGeneratedApps((prev) => [...prev, newApp]);
    } finally {
      setIsGenerating(false);
      setPrompt("");
    }
  }, [prompt, pricing]);

  const handleDeleteApp = (appId: string) => {
    setGeneratedApps((prev) => prev.filter((a) => a.id !== appId));
  };

  const handleDeployApp = (appId: string) => {
    setGeneratedApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: "deployed" as const } : a))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">App Builder</h1>
        <span className="text-sm text-gray-400">{generatedApps.length} app{generatedApps.length !== 1 ? "s" : ""} created</span>
      </div>

      {/* Prompt input */}
      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">App Idea Prompt</label>
          <textarea
            className="input-field min-h-[140px] resize-y"
            placeholder="Describe your app idea in plain English. Include the target audience, core features, user problems it solves, and how users would interact with it. The more detail you provide, the better the generated app will be..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-4">
          <div className="w-48">
            <label className="mb-1 block text-sm font-medium text-gray-300">Monthly Price ($)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              placeholder="9.99"
            />
          </div>
          <button
            onClick={handleGenerateApp}
            disabled={isGenerating || !prompt.trim()}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon />
            {isGenerating ? "Generating..." : "Generate App"}
          </button>
        </div>
      </div>

      {/* Template cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick-Start Templates</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APP_TEMPLATES.map((template) => (
            <div key={template.id} className="card">
              <h3 className="font-medium">{template.name}</h3>
              <p className="mt-1 text-sm text-gray-400">{template.description}</p>
              <button
                onClick={() => handleUseTemplate(template.prompt)}
                className="btn-secondary mt-3 w-full text-sm"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Generated apps list */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Your Apps</h2>
        {generatedApps.length > 0 ? (
          <div className="space-y-3">
            {generatedApps.map((app) => (
              <div key={app.id} className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{app.name}</h3>
                    <span className="badge badge-primary">{app.niche}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                    <span className={`badge ${app.status === "deployed" ? "badge-success" : app.status === "ready" ? "badge-primary" : app.status === "building" ? "badge-warn" : "badge-muted"}`}>
                      {app.status}
                    </span>
                    <span>${(app.pricing ?? 0).toFixed(2)}/mo</span>
                    <span>{app.subscribers} subscribers</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="btn-secondary text-sm">View</button>
                  <button className="btn-secondary text-sm">Edit</button>
                  <button
                    onClick={() => handleDeployApp(app.id)}
                    className="btn-primary text-sm"
                  >
                    Deploy
                  </button>
                  <button
                    onClick={() => handleDeleteApp(app.id)}
                    className="btn-secondary text-sm text-red-400 hover:border-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-400">No apps generated yet.</p>
            <p className="mt-1 text-sm text-gray-500">Describe an idea above or pick a template to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppBuilderSection;
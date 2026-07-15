"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


function SettingsSection() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => fetch("/api/business-profile").then((r) => r.json()),
  });

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setToast("Settings saved successfully!");
      setTimeout(() => setToast(null), 3000);
    },
    onError: () => {
      setToast("Failed to save settings.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate(formData);
  }, [formData, saveMutation]);

  const updateField = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const mergedSettings: Record<string, string> = {
    COMPOSIO_API_KEY: settings?.COMPOSIO_API_KEY || "",
    GHL_API_KEY: settings?.GHL_API_KEY || "",
    GHL_LOCATION_ID: settings?.GHL_LOCATION_ID || "",
    SMTP_URL: settings?.SMTP_URL || "",
    CRON_SECRET: settings?.CRON_SECRET || "",
    ...formData,
  };

  const mergedProfile: Record<string, string> = {
    businessName: profile?.businessName || "",
    city: profile?.city || "",
    state: profile?.state || "",
    services: profile?.services || "",
    targetKeywords: profile?.targetKeywords || "",
    ...formData,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* API Keys */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">API Keys &amp; Configuration</h2>
        <div className="space-y-4">
          <FormField label="COMPOSIO_API_KEY" value={mergedSettings.COMPOSIO_API_KEY} onChange={(v) => updateField("COMPOSIO_API_KEY", v)} placeholder="Enter Composio API key" secret />
          <FormField label="GHL_API_KEY" value={mergedSettings.GHL_API_KEY} onChange={(v) => updateField("GHL_API_KEY", v)} placeholder="Enter GoHighLevel API key" secret />
          <FormField label="GHL_LOCATION_ID" value={mergedSettings.GHL_LOCATION_ID} onChange={(v) => updateField("GHL_LOCATION_ID", v)} placeholder="Enter GHL Location ID" />
          <FormField label="SMTP_URL" value={mergedSettings.SMTP_URL} onChange={(v) => updateField("SMTP_URL", v)} placeholder="smtp://user:pass@host:port" />
          <FormField label="CRON_SECRET" value={mergedSettings.CRON_SECRET} onChange={(v) => updateField("CRON_SECRET", v)} placeholder="Cron job secret key" secret />
        </div>
      </div>

      {/* Business Profile */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Business Profile</h2>
        {profileLoading && isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Business Name" value={mergedProfile.businessName} onChange={(v) => updateField("businessName", v)} placeholder="Right Hand Services" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="City" value={mergedProfile.city} onChange={(v) => updateField("city", v)} placeholder="Troy" />
              <FormField label="State" value={mergedProfile.state} onChange={(v) => updateField("state", v)} placeholder="NC" />
            </div>
            <FormField label="Services" value={mergedProfile.services} onChange={(v) => updateField("services", v)} placeholder='["Handyman", "Cleaning", "Painting"]' />
            <FormField label="Target Keywords" value={mergedProfile.targetKeywords} onChange={(v) => updateField("targetKeywords", v)} placeholder='["handyman troy nc", "home repairs"]' />
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">{label}</label>
      <input
        type={secret ? "password" : "text"}
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default SettingsSection;

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "CRM" },
  { id: "pipelines", label: "Pipelines" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "sms", label: "SMS" },
  { id: "calls", label: "Calls" },
  { id: "payments", label: "Payments" },
  { id: "invoices", label: "Invoices" },
  { id: "reviews", label: "Reviews" },
  { id: "automations", label: "Automations" },
  { id: "forms", label: "Forms" },
  { id: "webhooks", label: "Webhooks" },
];

function StatCard({ label, value, color = "blue" }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    green: "border-green-500/30 bg-green-500/10 text-green-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  };
  return (
    <div className={`rounded border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function Badge({ text, variant = "default" }: { text: string; variant?: string }) {
  const v: Record<string, string> = {
    default: "badge",
    success: "badge badge-success",
    warning: "badge badge-warning",
    danger: "badge badge-danger",
  };
  return <span className={v[variant] || v.default}>{text}</span>;
}

function DataTable({ items, columns, onEdit, onDelete }: { items: any[]; columns: { key: string; label: string }[]; onEdit?: (item: any) => void; onDelete?: (id: string) => void }) {
  if (!items || items.length === 0) return <div className="card py-8 text-center text-gray-400">No data</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-700 text-left text-xs text-gray-500">{columns.map(c => <th key={c.key} className="px-3 py-2">{c.label}</th>)}<th className="px-3 py-2">Actions</th></tr></thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-800">
              {columns.map(c => <td key={c.key} className="px-3 py-2">{renderCell(item[c.key])}</td>)}
              <td className="px-3 py-2 flex gap-2">
                {onEdit && <button onClick={() => onEdit(item)} className="text-xs text-blue-400 hover:underline">Edit</button>}
                {onDelete && <button onClick={() => onDelete(item.id)} className="text-xs text-red-400 hover:underline">Del</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(val: any) {
  if (val === null || val === undefined) return <span className="text-gray-600">—</span>;
  if (typeof val === "boolean") return val ? "✓" : "✗";
  if (typeof val === "number" && val > 1000) return val.toLocaleString();
  if (val instanceof Date || (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/))) {
    return new Date(val).toLocaleDateString();
  }
  if (typeof val === "string" && val.startsWith("[")) return <span className="text-xs text-gray-500">{val.length} items</span>;
  return String(val);
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["ghl-analytics"], queryFn: () => fetch("/api/ghl/analytics").then(r => r.json()) });
  if (isLoading) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>;
  const s = stats || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active Contacts" value={s.contacts?.active || 0} color="blue" />
        <StatCard label="Open Deals" value={s.opportunities?.open || 0} color="green" />
        <StatCard label="Revenue" value={`$${((s.revenue || 0) / 100).toFixed(0)}`} color="green" />
        <StatCard label="Avg Review" value={`${(s.reviews?.avgRating || 0).toFixed(1)} ★`} color="yellow" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending Tasks" value={s.tasks?.pending || 0} color="yellow" />
        <StatCard label="Upcoming Appts" value={s.calendar?.upcoming || 0} color="purple" />
        <StatCard label="SMS Sent" value={s.sms?.total || 0} color="blue" />
        <StatCard label="Missed Calls" value={s.calls?.missed || 0} color="red" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending Payments" value={s.payments?.pending || 0} color="yellow" />
        <StatCard label="Overdue Invoices" value={s.invoices?.overdue || 0} color="red" />
        <StatCard label="Total Reviews" value={s.reviews?.total || 0} color="blue" />
        <StatCard label="Active Automations" value={s.automations?.active || 0} color="green" />
      </div>
    </div>
  );
}

// ── Contacts Tab ──────────────────────────────────────────────────
function ContactsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ghl-contacts"], queryFn: () => fetch("/api/ghl/contacts").then(r => r.json()).then(d => d.data || []) });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "" });

  const mut = useMutation({
    mutationFn: (body: any) => fetch("/api/ghl/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ghl-contacts"] }); setShowAdd(false); setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", source: "" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Contacts</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">+ Add Contact</button>
      </div>
      {showAdd && (
        <div className="card grid grid-cols-2 gap-3 lg:grid-cols-3">
          <input placeholder="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="input" />
          <input placeholder="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="input" />
          <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" />
          <input placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="input" />
          <input placeholder="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="input" />
          <div className="col-span-full flex justify-end">
            <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="btn-primary text-sm">{mut.isPending ? "Saving..." : "Save Contact"}</button>
          </div>
        </div>
      )}
      {isLoading ? <div className="skeleton h-48" /> : (
        <DataTable items={data} columns={[
          { key: "firstName", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "company", label: "Company" },
          { key: "leadScore", label: "Score" },
          { key: "status", label: "Status" },
        ]} />
      )}
    </div>
  );
}

// ── Generic Tab for all other resources ────────────────────────────
function GenericTab({ endpoint, label, columns, addFields }: {
  endpoint: string; label: string;
  columns: { key: string; label: string }[];
  addFields: { key: string; label: string; type?: string; options?: string[] }[];
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [`ghl-${endpoint}`],
    queryFn: () => fetch(`/api/ghl/${endpoint}`).then(r => r.json()).then(d => d.data || []),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const items = Array.isArray(data) ? data : [];

  const mut = useMutation({
    mutationFn: (body: any) => fetch(`/api/ghl/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`ghl-${endpoint}`] }); setShowAdd(false); setForm({}); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/ghl/${endpoint}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`ghl-${endpoint}`] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">+ Add {label.slice(0, -1)}</button>
      </div>
      {showAdd && (
        <div className="card">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {addFields.map(f => (
              f.options ? (
                <select key={f.key} value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="input">
                  <option value="">{f.label}</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea key={f.key} placeholder={f.label} value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="input col-span-2" rows={3} />
              ) : (
                <input key={f.key} placeholder={f.label} value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="input" />
              )
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="btn-primary text-sm">
              {mut.isPending ? "Saving..." : `Save ${label.slice(0, -1)}`}
            </button>
          </div>
        </div>
      )}
      {isLoading ? <div className="skeleton h-48" /> : (
        <DataTable
          items={items}
          columns={columns}
          onDelete={(id) => deleteMut.mutate(id)}
        />
      )}
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────
export default function GhlSection() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">GoHighLevel</h1>
        <span className="badge badge-primary">Business OS</span>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded border border-gray-700 p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "contacts" && <ContactsTab />}
      {tab === "pipelines" && (
        <GenericTab endpoint="pipelines" label="Pipelines" columns={[
          { key: "name", label: "Name" }, { key: "isDefault", label: "Default" }, { key: "createdAt", label: "Created" },
        ]} addFields={[{ key: "name", label: "Pipeline Name" }, { key: "description", label: "Description" }]} />
      )}
      {tab === "calendar" && (
        <GenericTab endpoint="calendar" label="Events" columns={[
          { key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "startTime", label: "Start" }, { key: "status", label: "Status" },
        ]} addFields={[
          { key: "title", label: "Event Title" }, { key: "type", label: "Type", options: ["appointment", "meeting", "reminder", "class"] },
          { key: "startTime", label: "Start Time (ISO)" }, { key: "location", label: "Location" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]} />
      )}
      {tab === "tasks" && (
        <GenericTab endpoint="tasks" label="Tasks" columns={[
          { key: "title", label: "Title" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due" },
        ]} addFields={[
          { key: "title", label: "Task Title" }, { key: "priority", label: "Priority", options: ["low", "normal", "high", "urgent"] },
          { key: "description", label: "Description", type: "textarea" },
        ]} />
      )}
      {tab === "sms" && (
        <GenericTab endpoint="sms" label="SMS Logs" columns={[
          { key: "to", label: "To" }, { key: "direction", label: "Dir" }, { key: "body", label: "Message" }, { key: "status", label: "Status" }, { key: "sentAt", label: "Sent" },
        ]} addFields={[
          { key: "to", label: "Phone Number" }, { key: "body", label: "Message", type: "textarea" },
          { key: "direction", label: "Direction", options: ["inbound", "outbound"] },
        ]} />
      )}
      {tab === "calls" && (
        <GenericTab endpoint="calls" label="Call Logs" columns={[
          { key: "to", label: "To" }, { key: "direction", label: "Dir" }, { key: "duration", label: "Duration" }, { key: "status", label: "Status" }, { key: "calledAt", label: "Date" },
        ]} addFields={[
          { key: "to", label: "Phone Number" }, { key: "direction", label: "Direction", options: ["inbound", "outbound"] },
          { key: "duration", label: "Duration (sec)" }, { key: "status", label: "Status", options: ["completed", "missed", "voicemail", "no_answer"] },
        ]} />
      )}
      {tab === "payments" && (
        <GenericTab endpoint="payments" label="Payments" columns={[
          { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "planName", label: "Plan" }, { key: "status", label: "Status" }, { key: "createdAt", label: "Date" },
        ]} addFields={[
          { key: "amount", label: "Amount" }, { key: "method", label: "Method", options: ["stripe", "paypal", "cash", "check"] },
          { key: "planName", label: "Plan Name" }, { key: "status", label: "Status", options: ["pending", "completed", "failed", "refunded"] },
        ]} />
      )}
      {tab === "invoices" && (
        <GenericTab endpoint="invoices" label="Invoices" columns={[
          { key: "invoiceNumber", label: "Invoice #" }, { key: "total", label: "Total" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due" },
        ]} addFields={[
          { key: "invoiceNumber", label: "Invoice Number" }, { key: "total", label: "Total" },
          { key: "status", label: "Status", options: ["draft", "sent", "paid", "overdue", "cancelled"] },
        ]} />
      )}
      {tab === "reviews" && (
        <GenericTab endpoint="reviews" label="Reviews" columns={[
          { key: "platform", label: "Platform" }, { key: "rating", label: "Rating" }, { key: "reviewerName", label: "Reviewer" }, { key: "status", label: "Status" },
        ]} addFields={[
          { key: "platform", label: "Platform", options: ["google", "facebook", "yelp", "bbb"] },
          { key: "rating", label: "Rating (1-5)" }, { key: "reviewerName", label: "Reviewer Name" },
          { key: "reviewText", label: "Review Text", type: "textarea" },
        ]} />
      )}
      {tab === "automations" && (
        <GenericTab endpoint="automations" label="Automations" columns={[
          { key: "name", label: "Name" }, { key: "trigger", label: "Trigger" }, { key: "status", label: "Status" }, { key: "runCount", label: "Runs" },
        ]} addFields={[
          { key: "name", label: "Automation Name" }, { key: "trigger", label: "Trigger" },
          { key: "status", label: "Status", options: ["active", "paused", "draft"] },
        ]} />
      )}
      {tab === "forms" && (
        <GenericTab endpoint="forms" label="Forms" columns={[
          { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "submissions", label: "Submissions" }, { key: "status", label: "Status" },
        ]} addFields={[
          { key: "name", label: "Form Name" }, { key: "type", label: "Type", options: ["contact", "quote", "survey", "intake"] },
        ]} />
      )}
      {tab === "webhooks" && (
        <GenericTab endpoint="webhooks" label="Webhooks" columns={[
          { key: "name", label: "Name" }, { key: "url", label: "URL" }, { key: "hitCount", label: "Hits" }, { key: "status", label: "Status" },
        ]} addFields={[
          { key: "name", label: "Webhook Name" }, { key: "url", label: "Endpoint URL" },
          { key: "status", label: "Status", options: ["active", "paused"] },
        ]} />
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import { create } from "zustand";
import SectionLoading from "@/components/dashboard/SectionLoading";

/* ------------------------------------------------------------------ */
/*  Zustand store                                                       */
/* ------------------------------------------------------------------ */

interface DashboardStore {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const useStore = create<DashboardStore>((set) => ({
  activeSection: "dashboard",
  setActiveSection: (section) => set({ activeSection: section }),
}));

/* ------------------------------------------------------------------ */
/*  Dynamic imports — each section lazy-loads on demand                */
/* ------------------------------------------------------------------ */

const DashboardSection = dynamic(
  () => import("@/components/sections/DashboardSection"),
  { loading: () => <SectionLoading /> }
);
const ContentLibrarySection = dynamic(
  () => import("@/components/sections/ContentLibrarySection"),
  { loading: () => <SectionLoading /> }
);
const AIComposerSection = dynamic(
  () => import("@/components/sections/AIComposerSection"),
  { loading: () => <SectionLoading /> }
);
const ApprovalsSection = dynamic(
  () => import("@/components/sections/ApprovalsSection"),
  { loading: () => <SectionLoading /> }
);
const SchedulerSection = dynamic(
  () => import("@/components/sections/SchedulerSection"),
  { loading: () => <SectionLoading /> }
);
const ConnectionsSection = dynamic(
  () => import("@/components/sections/ConnectionsSection"),
  { loading: () => <SectionLoading /> }
);
const HistorySection = dynamic(
  () => import("@/components/sections/HistorySection"),
  { loading: () => <SectionLoading /> }
);
const AuditsSection = dynamic(
  () => import("@/components/sections/AuditsSection"),
  { loading: () => <SectionLoading /> }
);
const AppBuilderSection = dynamic(
  () => import("@/components/sections/AppBuilderSection"),
  { loading: () => <SectionLoading /> }
);
const ContentEngineSection = dynamic(
  () => import("@/components/sections/ContentEngineSection"),
  { loading: () => <SectionLoading /> }
);
const LarkWorkspaceSection = dynamic(
  () => import("@/components/sections/LarkWorkspaceSection"),
  { loading: () => <SectionLoading /> }
);
const GhlSection = dynamic(
  () => import("@/components/sections/GhlSection"),
  { loading: () => <SectionLoading /> }
);
const SettingsSection = dynamic(
  () => import("@/components/sections/SettingsSection"),
  { loading: () => <SectionLoading /> }
);
const OsDashboardSection = dynamic(
  () => import("@/components/sections/OsDashboardSection"),
  { loading: () => <SectionLoading /> }
);
const HermesConfigSection = dynamic(
  () => import("@/components/sections/HermesConfigSection"),
  { loading: () => <SectionLoading /> }
);

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "content", label: "Content Library", icon: ContentIcon },
  { id: "composer", label: "AI Composer", icon: ComposerIcon },
  { id: "approvals", label: "Approvals", icon: ApprovalsIcon },
  { id: "scheduler", label: "Scheduler", icon: SchedulerIcon },
  { id: "connections", label: "Connections", icon: ConnectionsIcon },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "audits", label: "Audits", icon: AuditsIcon },
  { id: "app-builder", label: "App Builder", icon: AppBuilderIcon },
  { id: "content-engine", label: "Content Engine", icon: ContentEngineIcon },
  { id: "lark", label: "Lark Workspace", icon: LarkIcon },
  { id: "ghl", label: "GoHighLevel", icon: GhlIcon },
  { id: "os-dashboard", label: "OS Dashboard", icon: OsDashboardIcon },
  { id: "hermes-config", label: "Hermes Config", icon: HermesConfigIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-6a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1m-2 0h2" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ComposerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function ApprovalsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SchedulerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ConnectionsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AuditsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AppBuilderIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function ContentEngineIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function LarkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );
}

function GhlIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function OsDashboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function HermesConfigIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 15v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Section router                                                     */
/* ------------------------------------------------------------------ */

const SECTIONS: Record<string, React.ComponentType> = {
  dashboard: DashboardSection,
  content: ContentLibrarySection,
  composer: AIComposerSection,
  approvals: ApprovalsSection,
  scheduler: SchedulerSection,
  connections: ConnectionsSection,
  history: HistorySection,
  audits: AuditsSection,
  "app-builder": AppBuilderSection,
  "content-engine": ContentEngineSection,
  lark: LarkWorkspaceSection,
  ghl: GhlSection,
  "os-dashboard": OsDashboardSection,
  "hermes-config": HermesConfigSection,
  settings: SettingsSection,
};

/* ------------------------------------------------------------------ */
/*  Login Form                                                          */
/* ------------------------------------------------------------------ */

function LoginForm() {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password");
    }
    // If success, useSession will trigger re-render automatically
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-400">Crosspost Studio</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to your dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-xl"
        >
          {error && (
            <div className="rounded border border-red-500 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="admin@local"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-xs text-gray-600">
            Default: admin@local / admin12345678
          </p>
        </form>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const { activeSection, setActiveSection } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = useCallback(
    (section: string) => {
      setActiveSection(section);
      setMobileMenuOpen(false);
    },
    [setActiveSection]
  );

  // Show loading while session is being checked
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (status === "unauthenticated" || !session) {
    return <LoginForm />;
  }

  const ActiveSectionComponent = SECTIONS[activeSection] || DashboardSection;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-700 px-4">
          <h1 className="text-lg font-bold text-blue-400">Crosspost Studio</h1>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`sidebar-link w-full ${
                      activeSection === item.id ? "active" : ""
                    }`}
                  >
                    <Icon />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4">
          {session?.user && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-700 hover:text-white"
              >
                Sign out
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500">Crosspost Studio v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-700 px-4 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            <MenuIcon />
          </button>
          <h1 className="text-lg font-bold text-blue-400">Crosspost Studio</h1>
        </div>

        {/* Section content */}
        <div className="p-6">
          <ActiveSectionComponent />
        </div>
      </main>
    </div>
  );
}

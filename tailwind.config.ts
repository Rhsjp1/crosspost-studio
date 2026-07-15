import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        "primary-dark": "#2563eb",
        "primary-light": "#60a5fa",
        surface: "#111827",
        "surface-light": "#1f2937",
        "surface-lighter": "#374151",
        border: "#374151",
        "text-primary": "#f9fafb",
        "text-secondary": "#9ca3af",
        "text-muted": "#6b7280",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;

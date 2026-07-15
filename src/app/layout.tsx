import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Crosspost Studio",
  description: "AI-powered content creation, scheduling, and multi-platform publishing for small businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

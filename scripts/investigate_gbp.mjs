import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envRaw = fs.readFileSync(envPath, "utf8");
const m = envRaw.match(/DATABASE_URL="([^"]+)"/);
if (!m) { console.error("DATABASE_URL not found"); process.exit(1); }
process.env.DATABASE_URL = m[1];

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

try {
  // 1. All connections grouped by platform/status
  const all = await db.connection.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, platform: true, status: true, userId: true, label: true, updatedAt: true },
  });
  console.log("=== ALL Connection rows (count:", all.length, ") ===");
  const byPlatform = {};
  for (const r of all) {
    const k = `${r.platform}/${r.status}`;
    byPlatform[k] = (byPlatform[k] || 0) + 1;
  }
  console.log("by platform/status:", JSON.stringify(byPlatform, null, 2));
  console.log("\nRows:");
  for (const r of all) {
    console.log(`  ${r.platform} | ${r.status} | userId=${r.userId || "?"} | label=${r.label || "-"} | ${r.updatedAt.toISOString()}`);
  }

  // 2. Any google-ish platform value
  const googleish = await db.connection.findMany({
    where: { platform: { contains: "google" } },
    select: { id: true, platform: true, status: true, userId: true },
  });
  console.log("\n=== platform contains 'google' (count:", googleish.length, ") ===");
  console.log(JSON.stringify(googleish, null, 2));

  // 3. gbp_connected / gbp_post history events (most recent 20)
  const hist = await db.historyEvent.findMany({
    where: { action: { contains: "gbp" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { action: true, details: true, createdAt: true },
  });
  console.log("\n=== gbp* history events (count:", hist.length, ") ===");
  for (const h of hist) {
    console.log(`  ${h.createdAt.toISOString()} | ${h.action} | ${h.details}`);
  }
  if (hist.length === 0) console.log("  (none)");

  // 4. Any crosspost history mentioning google_business
  const xhist = await db.historyEvent.findMany({
    where: { action: "crosspost" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, platform: true, details: true, createdAt: true },
  });
  console.log("\n=== recent crosspost history (count:", xhist.length, ") ===");
  for (const h of xhist) {
    const d = h.details ? JSON.parse(h.details) : null;
    const plats = d?.results?.map((r) => `${r.platform}:${r.status}`).join(",") || h.platform;
    console.log(`  ${h.createdAt.toISOString()} | ${plats}`);
  }
} catch (e) {
  console.error("QUERY_ERROR:", e.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}

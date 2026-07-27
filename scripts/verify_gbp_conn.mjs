import fs from "fs";
import path from "path";

// Load DATABASE_URL from .env (Prisma client reads it at construct time)
const envPath = path.resolve(process.cwd(), ".env");
const envRaw = fs.readFileSync(envPath, "utf8");
const m = envRaw.match(/DATABASE_URL="([^"]+)"/);
if (!m) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
process.env.DATABASE_URL = m[1];

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

try {
  const rows = await db.connection.findMany({
    where: { platform: "google_business" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      platform: true,
      status: true,
      userId: true,
      label: true,
      accountName: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`Found ${rows.length} google_business Connection row(s):\n`);
  for (const r of rows) {
    let meta = {};
    try {
      meta = JSON.parse(r.accountName || "{}");
    } catch {}
    console.log("── Row ───────────────────────────────────────");
    console.log("id               :", r.id);
    console.log("platform         :", r.platform);
    console.log("status           :", r.status);
    console.log("userId           :", r.userId);
    console.log("label            :", r.label);
    console.log("accountId        :", meta.accountId || "(missing)");
    console.log("accountName      :", meta.accountName || "(missing)");
    console.log("defaultLocationId:", meta.defaultLocationId || "(missing)");
    const locs = Array.isArray(meta.locations) ? meta.locations : [];
    console.log("locations        :", locs.length, "->", locs.map((l) => `${l.title}(${l.locationId})`).join(", "));
    console.log("has accessToken  :", !!r.accessToken);
    console.log("has refreshToken :", !!r.refreshToken);
    console.log("expiresAt        :", r.expiresAt ? r.expiresAt.toISOString() : "(none)");
    const expired = r.expiresAt ? r.expiresAt.getTime() < Date.now() : true;
    console.log("token state      :", expired ? "EXPIRED (needs refresh)" : "valid");
    console.log("createdAt        :", r.createdAt.toISOString());
    console.log("updatedAt        :", r.updatedAt.toISOString());
    console.log("");
  }
  if (rows.length === 0) {
    console.log("No google_business Connection found. The OAuth connect flow may not have persisted a row, or it stored under a different platform value.");
  }
} catch (e) {
  console.error("QUERY_ERROR:", e.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}

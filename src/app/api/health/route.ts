import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks: { name: string; ok: boolean; ms: number }[] = [];

  // Database check
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    checks.push({ name: "database", ok: true, ms });
  } catch {
    checks.push({ name: "database", ok: false, ms: -1 });
  }

  // Composio config check
  try {
    const t0 = Date.now();
    const row = await db.appSetting.findUnique({
      where: { key: "COMPOSIO_API_KEY" },
    });
    const ms = Date.now() - t0;
    checks.push({ name: "composio_config", ok: !!row && row.value.length > 0, ms });
  } catch {
    checks.push({ name: "composio_config", ok: false, ms: -1 });
  }

  const allOk = checks.every((c) => c.ok);
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}

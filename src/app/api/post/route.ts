import { NextRequest, NextResponse } from "next/server";
import {
  PostRequestSchema,
  crossPost,
  authorized,
  PlatformResult,
} from "@/lib/crosspost";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 1. Auth
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Fan out (dry-run when explicitly requested — no real publish)
  const searchParams = new URL(req.url).searchParams;
  const dryRun = searchParams.get("dry_run") === "1" || parsed.data.dryRun === true;
  const results: PlatformResult[] = await crossPost(parsed.data, { dryRun });

  // 4. Per spec response shape
  const allOk = results.every(
    (r) => r.status === "success" || r.status === "queued"
  );
  return NextResponse.json(
    {
      status: dryRun ? "dry_run" : allOk ? "ok" : "partial",
      dryRun,
      results,
    },
    { status: allOk ? 200 : 207 }
  );
}

export async function GET(req: NextRequest) {
  // Auth — same bearer token, but allow read for ops dashboards.
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { db } = await import("@/lib/db");
  const limit = Math.min(
    parseInt(new URL(req.url).searchParams.get("limit") || "50", 10),
    200
  );

  const events = await db.historyEvent.findMany({
    where: { action: "crosspost" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    count: events.length,
    events: events.map((e) => ({
      createdAt: e.createdAt,
      platforms: e.platform,
      details: e.details ? JSON.parse(e.details) : null,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { scheduledPostSchema } from "@/lib/schemas";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    const where: Record<string, unknown> = {};
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const items = await db.scheduledPost.findMany({
      where,
      take: limit + 1,
      orderBy: { scheduledFor: "asc" },
      include: {
        content: { select: { id: true, title: true, status: true } },
      },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;

    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("GET /api/scheduled error:", error);
    return NextResponse.json({ error: "Failed to fetch scheduled posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = scheduledPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for idempotency
    const existing = await db.scheduledPost.findUnique({
      where: { idempotencyKey: parsed.data.idempotencyKey },
    });
    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }

    // Ensure the scheduledFor date is timezone-safe by parsing and re-serializing
    const scheduledFor = new Date(parsed.data.scheduledFor);
    if (isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledFor datetime" }, { status: 400 });
    }

    const post = await db.scheduledPost.create({
      data: {
        contentId: parsed.data.contentId,
        platform: parsed.data.platform,
        scheduledFor,
        idempotencyKey: parsed.data.idempotencyKey,
        leadCaptureEmail: parsed.data.leadCaptureEmail || null,
        status: "queued",
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/scheduled error:", error);
    return NextResponse.json({ error: "Failed to schedule post" }, { status: 500 });
  }
}

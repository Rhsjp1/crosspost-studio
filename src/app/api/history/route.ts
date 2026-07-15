import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    const where: Record<string, unknown> = {};
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const items = await db.historyEvent.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: "desc" },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;

    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

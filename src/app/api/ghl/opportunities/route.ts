import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ghlOpportunitySchema } from "@/lib/schemas";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const pipelineId = url.searchParams.get("pipelineId") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (cursor) where.createdAt = { lt: new Date(cursor) };
    if (pipelineId) where.pipelineId = pipelineId;
    const items = await db.ghlOpportunity.findMany({ where, take: limit + 1, orderBy: { createdAt: "desc" } });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;
    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("[ghl-opportunities GET]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = ghlOpportunitySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    const item = await db.ghlOpportunity.create({ data: parsed.data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[ghl-opportunities POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const item = await db.ghlOpportunity.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error("[ghl-opportunities PUT]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await db.ghlOpportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ghl-opportunities DELETE]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

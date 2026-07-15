import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ghlPipelineSchema } from "@/lib/schemas";

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
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const cursor = url.searchParams.get("cursor") || undefined;
    const where: Record<string, unknown> = {};
    if (cursor) where.createdAt = { lt: new Date(cursor) };
    const items = await db.ghlPipeline.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: "desc" },
      include: { stages: true, _count: { select: { opportunities: true } } },
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;
    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("[ghl-pipelines GET]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = ghlPipelineSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    const pipeline = await db.ghlPipeline.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isDefault: parsed.data.isDefault,
        stages: parsed.data.stages
          ? { create: parsed.data.stages.map((s) => ({ name: s.name, position: s.position })) }
          : undefined,
      },
      include: { stages: true },
    });
    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    console.error("[ghl-pipelines POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const item = await db.ghlPipeline.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error("[ghl-pipelines PUT]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await db.ghlPipeline.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ghl-pipelines DELETE]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

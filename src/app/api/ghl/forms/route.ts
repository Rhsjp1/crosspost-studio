import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ghlFormSchema } from "@/lib/schemas";

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
    const type = url.searchParams.get("type") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (cursor) where.createdAt = { lt: new Date(cursor) };
    const items = await db.ghlForm.findMany({ where, take: limit + 1, orderBy: { createdAt: "desc" } });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;
    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("[ghl-forms GET]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = ghlFormSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    const item = await db.ghlForm.create({ data: parsed.data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[ghl-forms POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const item = await db.ghlForm.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error("[ghl-forms PUT]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await db.ghlForm.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ghl-forms DELETE]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

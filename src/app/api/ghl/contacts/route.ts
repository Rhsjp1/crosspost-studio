import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ghlContactSchema, ghlBulkContactSchema } from "@/lib/schemas";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

// GET: list/search contacts
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const tag = url.searchParams.get("tag") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (cursor) where.createdAt = { lt: new Date(cursor) };
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { company: { contains: search } },
      ];
    }
    if (tag) where.tags = { contains: tag };

    const items = await db.ghlContact.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: "desc" },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? items[limit].createdAt.toISOString() : null;

    return NextResponse.json({ data, nextCursor });
  } catch (error) {
    console.error("[ghl-contacts GET]", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

// POST: create single contact
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = ghlContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const contact = await db.ghlContact.create({ data: parsed.data });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("[ghl-contacts POST]", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}

// PUT: update contact
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "Contact ID required" }, { status: 400 });

    const contact = await db.ghlContact.update({ where: { id }, data });
    return NextResponse.json(contact);
  } catch (error) {
    console.error("[ghl-contacts PUT]", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

// POST /bulk: import multiple contacts
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (body.action === "bulk-import") {
      const parsed = ghlBulkContactSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
      }
      const result = await db.ghlContact.createMany({ data: parsed.data.items });
      return NextResponse.json({ count: result.count }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[ghl-contacts PATCH]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE: archive contact
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Contact ID required" }, { status: 400 });

    await db.ghlContact.update({ where: { id }, data: { status: "archived" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ghl-contacts DELETE]", error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}

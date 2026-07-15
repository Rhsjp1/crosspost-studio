import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/apps/[id] — single app
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const app = await db.microApp.findUnique({
      where: { id },
      include: {
        deployments: { orderBy: { createdAt: "desc" } },
        subscribers: { orderBy: { createdAt: "desc" } },
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json(app);
  } catch (error) {
    console.error("[GET /api/apps/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch app" },
      { status: 500 }
    );
  }
}

// PATCH /api/apps/[id] — update app
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Check app exists
    const existing = await db.microApp.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Build update payload from provided fields
    const data: Record<string, unknown> = {};
    const allowed = [
      "name", "description", "niche", "pricing", "status",
      "pages", "config", "prompt",
    ] as const;
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const app = await db.microApp.update({
      where: { id },
      data,
    });

    return NextResponse.json(app);
  } catch (error) {
    console.error("[PATCH /api/apps/[id]]", error);
    return NextResponse.json(
      { error: "Failed to update app" },
      { status: 500 }
    );
  }
}

// DELETE /api/apps/[id] — delete app
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.microApp.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Cascading deletes handle deployments & subscribers via schema
    await db.microApp.delete({ where: { id } });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("[DELETE /api/apps/[id]]", error);
    return NextResponse.json(
      { error: "Failed to delete app" },
      { status: 500 }
    );
  }
}

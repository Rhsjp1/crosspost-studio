import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

// GET: fetch a single audit run in full detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const run = await db.auditRun.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!run) {
      return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error("GET /api/audits/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch audit run" }, { status: 500 });
  }
}

// PATCH: update notes on an audit run
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : null;

    const existing = await db.auditRun.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
    }

    const updated = await db.auditRun.update({
      where: { id },
      data: { notes },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/audits/[id] error:", error);
    return NextResponse.json({ error: "Failed to update audit run" }, { status: 500 });
  }
}

// DELETE: remove an audit run permanently
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.auditRun.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
    }

    await db.auditRun.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/audits/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete audit run" }, { status: 500 });
  }
}

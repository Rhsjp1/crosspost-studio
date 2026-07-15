import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/apps/[id]/subscribers — list subscribers
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify app exists
    const app = await db.microApp.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const subscribers = await db.subscriber.findMany({
      where: { appId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscribers);
  } catch (error) {
    console.error("[GET /api/apps/[id]/subscribers]", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST /api/apps/[id]/subscribers — add subscriber
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { email, name } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // Verify app exists
    const app = await db.microApp.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // upsert via create (unique constraint on appId+email)
    const subscriber = await db.subscriber.create({
      data: {
        appId: id,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        status: "active",
      },
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Subscriber with this email already exists for this app" },
        { status: 409 }
      );
    }

    console.error("[POST /api/apps/[id]/subscribers]", error);
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}

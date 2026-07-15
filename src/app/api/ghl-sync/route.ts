import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: list GHL sync records
export async function GET() {
  try {
    const syncs = await db.ghlSync.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(syncs);
  } catch (error) {
    console.error("[ghl-sync GET]", error);
    return NextResponse.json({ error: "Failed to fetch GHL syncs" }, { status: 500 });
  }
}

// POST: create a new GHL sync record
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contactName, email, action, pipeline, status } = body;

    if (!contactName || !action) {
      return NextResponse.json({ error: "Missing contactName or action" }, { status: 400 });
    }

    const sync = await db.ghlSync.create({
      data: {
        contactName,
        email: email || null,
        action,
        pipeline: pipeline || null,
        status: status || "pending",
      },
    });

    return NextResponse.json(sync, { status: 201 });
  } catch (error) {
    console.error("[ghl-sync POST]", error);
    return NextResponse.json({ error: "Failed to create GHL sync" }, { status: 500 });
  }
}

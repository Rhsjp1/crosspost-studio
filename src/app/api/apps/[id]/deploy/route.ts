import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/apps/[id]/deploy — create deployment record
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const platform = body?.platform ?? "vercel";

    // Check app exists
    const app = await db.microApp.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Build mock deploy URL
    const slug = app.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const mockUrl = `https://${slug}.microapp.app`;

    // Create deployment record
    const deployment = await db.deployment.create({
      data: {
        appId: id,
        platform,
        url: mockUrl,
        status: "live",
        deployedAt: new Date(),
      },
    });

    // Update app status
    await db.microApp.update({
      where: { id },
      data: { status: "deployed" },
    });

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    console.error("[POST /api/apps/[id]/deploy]", error);
    return NextResponse.json(
      { error: "Failed to deploy app" },
      { status: 500 }
    );
  }
}

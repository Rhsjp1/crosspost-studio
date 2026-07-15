import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateAppFromPrompt } from "@/lib/app-generator";

// GET /api/apps — list all micro-apps
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const apps = await db.microApp.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscribers: true, deployments: true } },
      },
    });
    return NextResponse.json(apps);
  } catch (error) {
    console.error("[GET /api/apps]", error);
    return NextResponse.json(
      { error: "Failed to fetch apps" },
      { status: 500 }
    );
  }
}

// POST /api/apps — create app from prompt + generate pages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, authorId } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return NextResponse.json(
        { error: "prompt is required and must be at least 5 characters" },
        { status: 400 }
      );
    }

    if (!authorId || typeof authorId !== "string") {
      return NextResponse.json(
        { error: "authorId is required" },
        { status: 400 }
      );
    }

    // Generate the app from the prompt
    const generated = generateAppFromPrompt(prompt, authorId);

    // Save to DB
    const app = await db.microApp.create({
      data: {
        name: generated.name,
        description: generated.description,
        prompt: prompt,
        niche: generated.niche,
        pricing: generated.pricing,
        status: "ready",
        pages: generated.pages,
        config: generated.config,
        authorId,
      },
    });

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    console.error("[POST /api/apps]", error);
    return NextResponse.json(
      { error: "Failed to create app" },
      { status: 500 }
    );
  }
}

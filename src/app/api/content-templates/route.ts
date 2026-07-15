import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/content-templates — list templates
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const platform = req.nextUrl.searchParams.get("platform");
    const category = req.nextUrl.searchParams.get("category");

    const templates = await db.contentTemplate.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(platform ? { platform } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("[GET /api/content-templates]", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/content-templates — create template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, category, platform, template, variables, authorId } = body;

    // Validate required fields
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    if (!type || typeof type !== "string") {
      return NextResponse.json(
        { error: "type is required (hook | script | caption | landing_page | email)" },
        { status: 400 }
      );
    }
    if (!template || typeof template !== "string") {
      return NextResponse.json(
        { error: "template is required" },
        { status: 400 }
      );
    }
    if (!authorId || typeof authorId !== "string") {
      return NextResponse.json(
        { error: "authorId is required" },
        { status: 400 }
      );
    }

    const created = await db.contentTemplate.create({
      data: {
        name: name.trim(),
        type,
        category: category?.trim() || null,
        platform: platform?.trim() || null,
        template,
        variables: Array.isArray(variables) ? JSON.stringify(variables) : "[]",
        authorId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/content-templates]", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

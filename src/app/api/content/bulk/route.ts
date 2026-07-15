import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { contentCreateSchema } from "@/lib/schemas";
import { z } from "zod";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

const bulkContentSchema = z.object({
  items: z
    .array(contentCreateSchema)
    .min(1, "At least one item required")
    .max(100, "Maximum 100 items per bulk import"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bulkContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    const items = parsed.data.items.map((item) => ({
      ...item,
      authorId: userId,
    }));

    const result = await db.content.createMany({
      data: items,
    });

    // Fetch the created items back to return them
    // createMany doesn't return the records, so we query the latest batch
    const created = await db.content.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: result.count,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      {
        count: result.count,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/content/bulk error:", error);
    return NextResponse.json({ error: "Failed to bulk create content" }, { status: 500 });
  }
}

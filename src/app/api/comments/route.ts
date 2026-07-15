import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: list comments for a content item, or all comments
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contentId = searchParams.get("contentId");

    const comments = await db.comment.findMany({
      where: contentId ? { contentId } : undefined,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error("[comments GET]", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST: create a new comment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, authorId, contentId, mentions } = body;

    if (!text || !authorId || !contentId) {
      return NextResponse.json(
        { error: "Missing text, authorId, or contentId" },
        { status: 400 }
      );
    }

    const comment = await db.comment.create({
      data: {
        text,
        authorId,
        contentId,
        mentions: mentions ? JSON.stringify(mentions) : "[]",
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("[comments POST]", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

// DELETE: remove a comment
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing comment id" }, { status: 400 });
    }

    await db.comment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[comments DELETE]", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

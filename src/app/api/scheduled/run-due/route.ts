import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const userId = (session.user as { id?: string }).id;

    // Find all queued posts whose scheduledFor has passed
    const duePosts = await db.scheduledPost.findMany({
      where: {
        status: "queued",
        scheduledFor: { lte: now },
      },
      include: {
        content: true,
      },
    });

    if (duePosts.length === 0) {
      return NextResponse.json({ message: "No due posts found", published: 0 });
    }

    let published = 0;
    const errors: string[] = [];

    for (const post of duePosts) {
      try {
        // Update the post to published
        await db.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "published",
            publishedAt: now,
          },
        });

        // Optionally update the parent content status to published if all scheduled posts are done
        const remaining = await db.scheduledPost.count({
          where: {
            contentId: post.contentId,
            status: "queued",
          },
        });

        if (remaining === 0) {
          await db.content.update({
            where: { id: post.contentId },
            data: { status: "published" },
          });
        }

        // Log history event
        await db.historyEvent.create({
          data: {
            action: "publish_scheduled",
            platform: post.platform,
            contentId: post.contentId,
            userId: userId || undefined,
            details: `Scheduled post ${post.id} published at ${now.toISOString()}`,
          },
        });

        published++;
      } catch (err) {
        errors.push(`Post ${post.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      published,
      total: duePosts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("POST /api/scheduled/run-due error:", error);
    return NextResponse.json({ error: "Failed to run due posts" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Composio OAuth callback
// Composio redirects here after user authorizes a connection.
// We update the local Connection record with the connected status.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connection_id") || searchParams.get("id");
    const status = searchParams.get("status");
    const error = searchParams.get("error");

    if (error) {
      console.error("[connections callback] Composio error:", error);
      // Find and mark the connection as failed
      if (connectionId) {
        await db.connection.updateMany({
          where: { accountId: connectionId },
          data: { status: "failed" },
        });
      }
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}?connection_error=${encodeURIComponent(error)}`
      );
    }

    if (connectionId) {
      // Update local connection record
      await db.connection.updateMany({
        where: { accountId: connectionId },
        data: {
          status: "connected",
        },
      });

      // Log to history
      await db.historyEvent.create({
        data: {
          action: "platform_connected",
          details: JSON.stringify({ connectionId, status }),
        },
      });
    }

    // Redirect back to the app's connections page
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}?section=connections&connected=true`
    );
  } catch (err) {
    console.error("[connections callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}?connection_error=callback_failed`
    );
  }
}

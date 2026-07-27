import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGbpAuthUrl } from "@/lib/gbp";

// GET /api/auth/gbp/start
// Kicks off the GBP OAuth flow. Must be called from an authenticated session:
// the logged-in user id is embedded in `state` so the callback can attribute
// the connection. Redirects the browser to Google's consent screen.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const authUrl = buildGbpAuthUrl(userId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[gbp/start]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

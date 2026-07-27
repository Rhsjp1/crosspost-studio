import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  exchangeCodeForTokens,
  listGbpAccounts,
  listGbpLocations,
  GBP_PLATFORM,
} from "@/lib/gbp";

// GET /api/auth/callback
// Google OAuth redirect target (configured in Google Cloud Console).
// Exchanges the code for tokens, discovers the managed GBP account + location(s),
// and stores everything in the `Connection` table (platform = "google_business").
//
// NOTE: this static route takes precedence over /api/auth/[...nextauth] for the
// exact path /api/auth/callback, so NextAuth's catch-all is unaffected.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // = userId (set in /gbp/start)
  const error = searchParams.get("error");
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (error) {
    console.error("[gbp callback] Google error:", error);
    return NextResponse.redirect(`${base}?section=connections&gbp_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}?section=connections&gbp_error=missing_params`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accessToken = tokens.access_token;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    const accounts = await listGbpAccounts(accessToken);
    if (accounts.length === 0) {
      return NextResponse.redirect(`${base}?section=connections&gbp_error=no_accounts`);
    }

    const account = accounts[0];
    const locations = await listGbpLocations(accessToken, account.id);
    const defaultLocation = locations[0];

    const existing = await db.connection.findFirst({
      where: { platform: GBP_PLATFORM, userId: state },
    });

    const accountName = JSON.stringify({
      accountId: account.id,
      accountName: account.name,
      locations,
      defaultLocationId: defaultLocation?.locationId || null,
    });

    if (existing) {
      await db.connection.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          accessToken,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          expiresAt,
          accountName,
        },
      });
    } else {
      await db.connection.create({
        data: {
          platform: GBP_PLATFORM,
          status: "connected",
          userId: state,
          accessToken,
          refreshToken: tokens.refresh_token || null,
          expiresAt,
          accountName,
          label: account.name,
        },
      });
    }

    await db.historyEvent.create({
      data: { action: "gbp_connected", details: JSON.stringify({ accountId: account.id, locations: locations.length }) },
    });

    return NextResponse.redirect(`${base}?section=connections&gbp=connected`);
  } catch (err) {
    console.error("[gbp callback]", err);
    return NextResponse.redirect(
      `${base}?section=connections&gbp_error=${encodeURIComponent(String(err).slice(0, 120))}`
    );
  }
}

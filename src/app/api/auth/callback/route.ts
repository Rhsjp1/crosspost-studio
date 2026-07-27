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

/** Retry a Google API call on 429/5xx with simple backoff. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isRetryable = /429|403|500|502|503|504/.test(msg);
      if (!isRetryable || i === attempts - 1) throw err;
      // exponential-ish backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

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

    // Persist the connection EARLY (right after we have tokens) so a transient
    // quota/rate-limit (429) on account/location discovery can't waste the
    // OAuth grant. We update accountName with discovery results below.
    const existing = await db.connection.findFirst({
      where: { platform: GBP_PLATFORM, userId: state },
    });
    const baseAccountName = JSON.stringify({ discovered: false });
    if (existing) {
      await db.connection.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          accessToken,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          expiresAt,
          accountName: baseAccountName,
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
          accountName: baseAccountName,
          label: "Google Business Profile",
        },
      });
    }

    // Discover account + locations (retry on transient quota/rate errors).
    const accounts = await withRetry(() => listGbpAccounts(accessToken));
    if (accounts.length === 0) {
      // Grant is fine; no GBP account managed by this Google user.
      return NextResponse.redirect(`${base}?section=connections&gbp_error=no_accounts`);
    }

    const account = accounts[0];
    const locations = await withRetry(() =>
      listGbpLocations(accessToken, account.id)
    );
    const defaultLocation = locations[0];

    const accountName = JSON.stringify({
      accountId: account.id,
      accountName: account.name,
      locations,
      defaultLocationId: defaultLocation?.locationId || null,
      discovered: true,
    });

    await db.connection.update({
      where: { id: existing?.id || (await db.connection.findFirst({
        where: { platform: GBP_PLATFORM, userId: state },
      }))!.id },
      data: { accountName },
    });

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

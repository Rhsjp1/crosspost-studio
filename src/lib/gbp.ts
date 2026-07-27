/**
 * Google Business Profile (GBP) direct integration.
 *
 * This uses the RHS OWN Google OAuth client (NOT Composio — Composio has no
 * GBP toolkit). Tokens are stored in the existing `Connection` table
 * (accessToken / refreshToken / expiresAt / accountName JSON), reusing the
 * same persistence pattern as the Composio connections.
 *
 * Authorized redirect URI (already configured in Google Cloud Console):
 *   https://crosspost-studio-azure.vercel.app/api/auth/callback
 *   http://localhost:3000/api/auth/callback
 *
 * GBP API notes:
 *  - Auth scope: https://www.googleapis.com/auth/business.manage
 *  - Account/location discovery: mybusinessaccountmanagement.googleapis.com/v1
 *  - Local Posts (the actual "post"): mybusiness.googleapis.com/v4 localPosts
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const LOCALPOST_BASE = "https://mybusiness.googleapis.com/v4";
export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GBP_PLATFORM = "google_business";

export function gbpRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback`;
}

export function gbpClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars");
  }
  return { clientId, clientSecret, redirectUri: gbpRedirectUri() };
}

/** Build the Google authorize URL (authorization-code + PKCE-less web-server flow). */
export function buildGbpAuthUrl(state: string): string {
  const { clientId, redirectUri } = gbpClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GBP_SCOPE,
    access_type: "offline", // required to get a refresh token
    prompt: "consent", // force refresh token even on re-auth
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
  scope?: string;
};

/** Exchange an authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = gbpClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Use a refresh token to obtain a fresh access token. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = gbpClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export type GbpAccount = { id: string; name: string; type?: string };
export type GbpLocation = { name: string; title: string; locationId: string };

/** List GBP accounts the authenticated user manages. */
export async function listGbpAccounts(accessToken: string): Promise<GbpAccount[]> {
  const res = await fetch(`${ACCOUNT_MGMT}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`listAccounts failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = (await res.json()) as { accounts?: Array<{ name: string; accountName?: string; type?: string }> };
  return (data.accounts || []).map((a) => ({
    id: a.name.replace("accounts/", ""),
    name: a.accountName || a.name,
    type: a.type,
  }));
}

/** List locations under an account. */
export async function listGbpLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocation[]> {
  const res = await fetch(
    `${ACCOUNT_MGMT}/accounts/${accountId}/locations?pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`listLocations failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    locations?: Array<{ name: string; title?: string; locationName?: string }>;
  };
  return (data.locations || []).map((l) => ({
    name: l.name,
    title: l.title || l.locationName || l.name,
    locationId: l.name.split("/").pop() || l.name,
  }));
}

/**
 * Return a valid access token for a Connection, refreshing if expired.
 * Persists a new access token + expiresAt back to the row when refreshed.
 */
export async function getValidAccessToken(
  conn: { id: string; accessToken: string | null; refreshToken: string | null; expiresAt: Date | null }
): Promise<string> {
  if (!conn.accessToken) throw new Error("Connection has no access token");
  const expired = conn.expiresAt ? conn.expiresAt.getTime() < Date.now() + 60_000 : false;
  if (!expired) return conn.accessToken;
  if (!conn.refreshToken) throw new Error("Token expired and no refresh token available");

  const fresh = await refreshAccessToken(conn.refreshToken);
  const newExpiry = new Date(Date.now() + (fresh.expires_in || 3600) * 1000);
  // Lazy import to avoid circular dep at module load.
  const { db } = await import("./db");
  await db.connection.update({
    where: { id: conn.id },
    data: { accessToken: fresh.access_token, expiresAt: newExpiry },
  });
  return fresh.access_token;
}

export type GbpPostInput = {
  text: string; // <= 1500 chars
  link_url?: string;
  media_url?: string;
  callToActionType?: string; // e.g. "LEARN_MORE", "BOOK", "ORDER"
};

/**
 * Create a GBP Local Post on a specific location.
 * Docs: POST /v4/accounts/{accountId}/locations/{locationId}/localPosts
 */
export async function createGbpPost(
  accessToken: string,
  accountId: string,
  locationId: string,
  input: GbpPostInput
): Promise<{ name?: string }> {
  const summary = input.text.slice(0, 1500);
  const body: Record<string, unknown> = { languageCode: "en-US", summary };
  if (input.link_url || input.callToActionType) {
    body.callToAction = {
      actionType: input.callToActionType || "LEARN_MORE",
      url: input.link_url || undefined,
    };
  }
  if (input.media_url) {
    body.media = [
      { mediaFormat: "PHOTO", sourceUrl: input.media_url },
    ];
  }

  const res = await fetch(
    `${LOCALPOST_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`createGbpPost failed (${res.status}): ${err.slice(0, 400)}`);
  }
  return (await res.json()) as { name?: string };
}

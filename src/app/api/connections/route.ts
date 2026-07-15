import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const COMPOSIO_BASE = "https://backend.composio.dev";

// Toolkit slug mapping — exact slugs from Composio v3 /toolkits endpoint
const PLATFORM_TOOLKITS: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  twitter: "twitter",
  linkedin: "linkedin",
  youtube: "youtube",
  tiktok: "tiktok",
};

async function getComposioApiKey(): Promise<string | null> {
  try {
    const row = await db.appSetting.findUnique({
      where: { key: "COMPOSIO_API_KEY" },
    });
    return row?.value || process.env.COMPOSIO_API_KEY || null;
  } catch {
    return process.env.COMPOSIO_API_KEY || null;
  }
}

// GET: list connections from local DB
export async function GET() {
  try {
    const connections = await db.connection.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(connections);
  } catch (error) {
    console.error("[connections GET]", error);
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }
}

// POST: initiate a Composio connection for a platform
// Strategy: try v3.1 first, then v3 /link, then v3 /connected_accounts
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { platform, userId } = body;

    if (!platform || !userId) {
      return NextResponse.json({ error: "Missing platform or userId" }, { status: 400 });
    }

    const apiKey = await getComposioApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Composio API key not configured. Set it in Settings." },
        { status: 400 }
      );
    }

    const toolkit = PLATFORM_TOOLKITS[platform];
    if (!toolkit) {
      return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/connections/callback`;

    // Step 1: Get auth config ID for this toolkit
    const authConfigsRes = await fetch(
      `${COMPOSIO_BASE}/api/v3/auth_configs?toolkit=${toolkit}`,
      {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!authConfigsRes.ok) {
      const errText = await authConfigsRes.text();
      console.error("[connections] Auth config fetch failed:", authConfigsRes.status, errText);
      return NextResponse.json(
        { error: `Composio auth config lookup failed (${authConfigsRes.status}): ${errText.substring(0, 200)}` },
        { status: 502 }
      );
    }

    const authConfigsData = await authConfigsRes.json();
    const authConfigs = authConfigsData?.items || authConfigsData?.data || authConfigsData || [];

    if (!Array.isArray(authConfigs) || authConfigs.length === 0) {
      return NextResponse.json(
        { error: `No auth config found for ${toolkit}. Create one at composio.dev/dashboard first.` },
        { status: 404 }
      );
    }

    const authConfigId = authConfigs[0].id;

    // Step 2: Try connection — multiple endpoint strategies with fallback

    // Strategy A: POST /api/v3/connected_accounts/link (Composio Connect Links — preferred)
    const linkPayload = {
      auth_config_id: authConfigId,
      user_id: userId,
      callback_url: callbackUrl,
    };

    let lastError = "";

    // Try /link first
    const strategies = [
      { url: `${COMPOSIO_BASE}/api/v3/connected_accounts/link`, payload: linkPayload },
      { url: `${COMPOSIO_BASE}/api/v3.1/connected_accounts/link`, payload: linkPayload },
      {
        url: `${COMPOSIO_BASE}/api/v3/connected_accounts`,
        payload: {
          auth_config: { id: authConfigId },
          connection: { user_id: userId, redirect_uri: callbackUrl },
        },
      },
      {
        url: `${COMPOSIO_BASE}/api/v3.1/connected_accounts`,
        payload: {
          auth_config: { id: authConfigId },
          connection: { user_id: userId, redirect_uri: callbackUrl },
        },
      },
    ];

    for (const strategy of strategies) {
      try {
        const res = await fetch(strategy.url, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(strategy.payload),
        });

        if (res.ok) {
          const data = await res.json();

          // Extract redirect URL from various response shapes
          const redirectUrl =
            data.redirect_url ||
            data.redirectUrl ||
            data.link_token ||
            null;
          const connectionId =
            data.connected_account_id ||
            data.id ||
            data.connectionId ||
            null;

          if (!redirectUrl && !connectionId) {
            console.warn("[connections] Unexpected response shape:", JSON.stringify(data).substring(0, 300));
            lastError = `Response had no redirect URL or connection ID`;
            continue;
          }

          // Create local connection record (multiple allowed per platform)
          await db.connection.create({
            data: {
              platform,
              status: "initializing",
              accountId: connectionId || "",
              userId,
              label: body.label || null,
            },
          });

          return NextResponse.json({
            redirectUrl,
            connectionId,
            status: "initializing",
            endpoint: strategy.url,
          });
        }

        // Non-ok status — capture error but try next strategy
        const errText = await res.text();
        console.warn(`[connections] ${strategy.url} returned ${res.status}: ${errText.substring(0, 200)}`);
        lastError = `${strategy.url} → ${res.status}: ${errText.substring(0, 150)}`;

        // Don't retry 4xx client errors (they won't change with different endpoint)
        if (res.status >= 400 && res.status < 500 && res.status !== 410 && res.status !== 404) {
          break;
        }
      } catch (fetchErr) {
        lastError = `${strategy.url} → network error`;
        console.warn("[connections] Fetch error for", strategy.url, fetchErr);
      }
    }

    // All strategies failed
    return NextResponse.json(
      { error: `All Composio connection strategies failed. Last: ${lastError}` },
      { status: 502 }
    );
  } catch (error) {
    console.error("[connections POST]", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}

// PATCH: update connection status (e.g., after callback)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, accountId, accountName, accessToken, refreshToken } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
    }

    const updated = await db.connection.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(accountId !== undefined && { accountId }),
        ...(accountName !== undefined && { accountName }),
        ...(accessToken !== undefined && { accessToken }),
        ...(refreshToken !== undefined && { refreshToken }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[connections PATCH]", error);
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 });
  }
}

// DELETE: disconnect a platform
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
    }

    const conn = await db.connection.findUnique({ where: { id } });
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Try to delete from Composio if we have an accountId
    if (conn.accountId) {
      const apiKey = await getComposioApiKey();
      if (apiKey) {
        for (const path of [
          `/api/v3.1/connected_accounts/${conn.accountId}`,
          `/api/v3/connected_accounts/${conn.accountId}`,
        ]) {
          try {
            const res = await fetch(`${COMPOSIO_BASE}${path}`, {
              method: "DELETE",
              headers: { "x-api-key": apiKey },
            });
            if (res.ok || res.status === 404) break;
          } catch {
            // Non-blocking
          }
        }
      }
    }

    await db.connection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[connections DELETE]", error);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}

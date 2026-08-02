import { z } from "zod";
import { db } from "@/lib/db";

/**
 * RHS CrossPost API — shared types + fan-out logic.
 *
 * The /api/post endpoint accepts a platform list + copy and fans each item
 * out to the matching connected social account. Connections are stored in the
 * existing Connection table (Composio connected accounts) — no new schema
 * migration required. Posts that have no connected account are reported with
 * status "not_connected" so the caller (Hermes / cron) can surface them rather
 * than failing the whole batch.
 */

export const PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
  "google_business",
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** Composio toolkit slug per platform. "twitter" => X. Null = not Composio (e.g. GBP is direct). */
export const PLATFORM_TOOLKITS: Partial<Record<Platform, string>> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  x: "twitter",
  youtube: "youtube",
  tiktok: "tiktok",
};

export const PostRequestSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1, "At least one platform required"),
  userId: z.string().min(1).optional(), // required for google_business (GBP)
  text: z.string().min(1, "text is required").max(5000),
  media_url: z.string().url().optional(),
  link_url: z.string().url().optional(),
  schedule_at: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  campaign: z.string().optional(),
  // Facebook only: select a connected Page by alias (e.g. "main", "products").
  // Omit to use the default Page (the Connection flagged isDefault, else first).
  page_alias: z.string().optional(),
  // When true, resolve connections + build the exact payload but DO NOT publish.
  dryRun: z.boolean().optional(),
});
export type PostRequest = z.infer<typeof PostRequestSchema>;

export type PlatformResult = {
  platform: Platform;
  post_id: string | null;
  status: "success" | "queued" | "not_connected" | "error";
  detail?: string;
};

const COMPOSIO_BASE = "https://backend.composio.dev";

async function getComposioApiKey(): Promise<string | null> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: "COMPOSIO_API_KEY" } });
    return row?.value || process.env.COMPOSIO_API_KEY || null;
  } catch {
    return process.env.COMPOSIO_API_KEY || null;
  }
}

/**
 * Get a connected Composio account id for a platform.
 * For Facebook, an optional page_alias selects a specific Page Connection
 * (matched against the alias field in the Connection's accountName JSON).
 * If no alias is given, the Connection flagged isDefault is used; failing that,
 * the most recently updated connected account.
 */
async function getConnectedAccount(
  platform: Platform,
  pageAlias?: string
): Promise<{ accountId: string | null; connId?: string }> {
  const conns = await db.connection.findMany({
    where: { platform, status: "connected" },
    orderBy: { updatedAt: "desc" },
  });
  if (conns.length === 0) return { accountId: null };

  if (platform === "facebook" && pageAlias) {
    const match = conns.find((c) => {
      try {
        const meta = JSON.parse(c.accountName || "{}");
        return meta.alias === pageAlias;
      } catch {
        return false;
      }
    });
    if (match) return { accountId: match.accountId, connId: match.id };
    // alias not found — surface a clear "not_connected" style result
    return { accountId: null };
  }

  if (platform === "facebook") {
    const def = conns.find((c) => {
      try {
        return JSON.parse(c.accountName || "{}").isDefault === true;
      } catch {
        return false;
      }
    });
    const chosen = def || conns[0];
    return { accountId: chosen.accountId, connId: chosen.id };
  }

  return { accountId: conns[0].accountId, connId: conns[0].id };
}

/** Read a stored metadata value from a Connection row (e.g. pageId). */
async function getConnectionMeta(
  accountId: string,
  key: string
): Promise<string | null> {
  const conn = await db.connection.findFirst({ where: { accountId } });
  if (!conn) return null;
  const raw = conn.accountName || "{}";
  try {
    const meta = JSON.parse(raw);
    return meta[key] || null;
  } catch {
    return null;
  }
}

/** Fetch the LinkedIn author URN for a connected account via Composio. */
async function getLinkedInAuthorUrn(
  accountId: string,
  apiKey: string
): Promise<string | null> {
  // First try the locally cached URN.
  const cached = await getConnectionMeta(accountId, "authorUrn");
  if (cached) return cached;
  try {
    const res = await fetch(
      `${COMPOSIO_BASE}/api/v3/connected_accounts/${accountId}`,
      { headers: { "x-api-key": apiKey } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      user_metadata?: { id?: string; username?: string };
      accountName?: string;
    };
    const id = data.user_metadata?.id || data.user_metadata?.username;
    if (id) {
      const urn = id.startsWith("urn:") ? id : `urn:li:person:${id}`;
      // cache it
      await db.connection
        .updateMany({
          where: { accountId },
          data: { accountName: JSON.stringify({ authorUrn: urn }) },
        })
        .catch(() => {});
      return urn;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Post to a single platform via Composio.
 * Uses the v3 action-execution endpoint with the toolkit's create-post action.
 */
async function postToPlatform(
  platform: Platform,
  req: PostRequest,
  apiKey: string | null,
  dryRun = false
): Promise<PlatformResult> {
  const { accountId } = await getConnectedAccount(platform, req.page_alias);
  if (!accountId) {
    const detail =
      platform === "facebook" && req.page_alias
        ? `No connected Facebook Page with alias "${req.page_alias}"`
        : "No connected account";
    return { platform, post_id: null, status: "not_connected", detail };
  }

  const toolkit = PLATFORM_TOOLKITS[platform];
  // GBP is a DIRECT Google integration (no Composio toolkit) — route it to the worker.
  if (platform === "google_business") {
    const { postToGbp } = await import("./gbp-worker");
    const r = await postToGbp(
      req.userId || "",
      {
        text: req.text,
        link_url: req.link_url,
        media_url: req.media_url,
      },
      undefined,
      dryRun
    );
    return {
      platform,
      post_id: r.post_name || null,
      status:
        r.status === "success"
          ? "success"
          : r.status === "not_connected"
          ? "not_connected"
          : "error",
      detail: r.detail,
    };
  }

  const TOOL_SLUG: Partial<Record<Platform, string>> = {
    facebook: "FACEBOOK_CREATE_POST",
    instagram: "INSTAGRAM_CREATE_POST",
    linkedin: "LINKEDIN_CREATE_LINKED_IN_POST",
    x: "TWITTER_CREATE_POST",
    youtube: "YOUTUBE_CREATE_POST",
    tiktok: "TIKTOK_CREATE_POST",
  };
  const toolSlug = TOOL_SLUG[platform];
  if (!toolSlug) {
    return {
      platform,
      post_id: null,
      status: "error",
      detail: `No tool slug for ${platform}`,
    };
  }
  if (!apiKey) {
    return {
      platform,
      post_id: null,
      status: "error",
      detail: "Composio API key not configured",
    };
  }

  // Build the platform-specific input from the generic request.
  const input: Record<string, unknown> = {};
  if (platform === "linkedin") {
    const authorUrn = await getLinkedInAuthorUrn(accountId, apiKey);
    input.commentary = req.text;
    if (authorUrn) input.author = authorUrn;
    input.visibility = "PUBLIC";
    input.lifecycleState = "PUBLISHED";
    if (req.link_url) input.commentary = `${req.text}\n\n${req.link_url}`;
  } else if (platform === "facebook") {
    const pageId = await getConnectionMeta(accountId, "pageId");
    input.message = req.text;
    if (pageId) input.page_id = pageId;
    if (req.link_url) input.link = req.link_url;
    if (req.media_url) input.link = req.media_url;
  } else if (platform === "x") {
    input.text = req.text;
  } else if (platform === "instagram") {
    return {
      platform,
      post_id: null,
      status: "error",
      detail: "Instagram requires media upload (not supported via text post)",
    };
  } else if (platform === "youtube" || platform === "tiktok") {
    return {
      platform,
      post_id: null,
      status: "error",
      detail: `${platform} requires media upload (not supported via text post)`,
    };
  }

  // Composio v3 tool execution: POST /api/v3/tools/execute/{tool_slug}
  // Composio resolves the connected account for the given entity_id. We OMIT
  // connected_account_id so Composio auto-selects the connection owned by the
  // entity — this avoids the ActionExecute_ConnectedAccountEntityIdMismatch
  // (code 1812) that occurs when a connection belongs to a different entity
  // than the hardcoded one. ENTITY_ID is overridable via env for flexibility.
  const ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || "righthandservicesbyjp@gmail.com";

  const body: Record<string, unknown> = {
    entity_id: ENTITY_ID,
    arguments: input,
  };

  try {
    const res = await fetch(
      `${COMPOSIO_BASE}/api/v3/tools/execute/${toolSlug}`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // leave json null
    }

    // New logic: inspect inner successful flag and error fields.
    if (!res.ok) {
      const detail = `HTTP ${res.status}: ${text.slice(0, 200)}`;
      return { platform, post_id: null, status: "error", detail };
    }

    if (json && json.error) {
      const detail = `Composio unsuccessful: ${JSON.stringify(json.error).slice(0, 300)}`;
      return { platform, post_id: null, status: "error", detail };
    }

    const data = (json?.data || json) as { id?: string; post_id?: string };
    const postId = data?.id || data?.post_id || null;

    return {
      platform,
      post_id: postId,
      status: req.schedule_at ? "queued" : "success",
    };
  } catch (e) {
    return {
      platform,
      post_id: null,
      status: "error",
      detail: String(e).slice(0, 200),
    };
  }
}

/** Fan out one request across all requested platforms. */
export async function crossPost(
  req: PostRequest,
  opts?: { dryRun?: boolean }
): Promise<PlatformResult[]> {
  const dryRun = opts?.dryRun ?? false;
  const apiKey = await getComposioApiKey();
  const results = await Promise.all(
    req.platforms.map((p) =>
      apiKey || p === "google_business"
        ? postToPlatform(p, req, apiKey, dryRun)
        : Promise.resolve({
            platform: p,
            post_id: null,
            status: "not_connected" as const,
            detail: "Composio API key not configured",
          })
    )
  );

  try {
    const ok = results.filter(
      (r) => r.status === "success" || r.status === "queued"
    ).length;
    await db.historyEvent.create({
      data: {
        action: "crosspost",
        platform: req.platforms.join(","),
        details: JSON.stringify({
          campaign: req.campaign,
          text: req.text.slice(0, 200),
          results,
          posted: ok,
        }),
      },
    });
  } catch {
    // Non-fatal: history logging should never break a post.
  }

  return results;
}

/** Validate the bearer token against CROSSPOST_API_TOKEN. */
export function authorized(authHeader: string | null): boolean {
  const expected = process.env.CROSSPOST_API_TOKEN;
  if (!expected || !authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return false;
  const a = Buffer.from(token || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

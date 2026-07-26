import { z } from "zod";
import { db } from "@/lib/db";

/**
 * RHS CrossPost API — shared types + fan-out logic.
 *
 * The /api/post endpoint accepts a platform list + copy and fans each item
 * out to the matching connected social account. Connections are stored in the
 * existing `Connection` table (Composio connected accounts) — no new schema
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
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** Composio toolkit slug per platform. "twitter" => X. */
export const PLATFORM_TOOLKITS: Record<Platform, string> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
  x: "twitter",
  youtube: "youtube",
  tiktok: "tiktok",
};

export const PostRequestSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1, "At least one platform required"),
  text: z.string().min(1, "text is required").max(5000),
  media_url: z.string().url().optional(),
  link_url: z.string().url().optional(),
  schedule_at: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  campaign: z.string().optional(),
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

/** Get a connected Composio account id for a platform (latest connected one). */
async function getConnectedAccount(platform: Platform): Promise<string | null> {
  const conn = await db.connection.findFirst({
    where: { platform, status: "connected" },
    orderBy: { updatedAt: "desc" },
  });
  return conn?.accountId || null;
}

/**
 * Post to a single platform via Composio.
 * Uses the v3 action-execution endpoint with the toolkit's create-post action.
 */
async function postToPlatform(
  platform: Platform,
  req: PostRequest,
  apiKey: string
): Promise<PlatformResult> {
  const accountId = await getConnectedAccount(platform);
  if (!accountId) {
    return { platform, post_id: null, status: "not_connected", detail: "No connected account" };
  }

  const toolkit = PLATFORM_TOOLKITS[platform];
  const actionName = `${toolkit}_CREATE_POST`;

  // Composio v3 action execution.
  const body: Record<string, unknown> = {
    connected_account_id: accountId,
    action_name: actionName,
    input: {
      text: req.text,
      ...(req.media_url ? { media_url: req.media_url } : {}),
      ...(req.link_url ? { link: req.link_url } : {}),
      ...(req.schedule_at ? { scheduled_time: req.schedule_at } : {}),
    },
  };

  try {
    const res = await fetch(`${COMPOSIO_BASE}/api/v3/actions/execute`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { platform, post_id: null, status: "error", detail: `HTTP ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { data?: { id?: string; post_id?: string } };
    const postId = data.data?.id || data.data?.post_id || null;
    return {
      platform,
      post_id: postId,
      status: req.schedule_at ? "queued" : "success",
    };
  } catch (e) {
    return { platform, post_id: null, status: "error", detail: String(e).slice(0, 200) };
  }
}

/** Fan out one request across all requested platforms. */
export async function crossPost(req: PostRequest): Promise<PlatformResult[]> {
  const apiKey = await getComposioApiKey();
  const results = await Promise.all(
    req.platforms.map((p) => (apiKey ? postToPlatform(p, req, apiKey) : Promise.resolve({
      platform: p,
      post_id: null,
      status: "not_connected" as const,
      detail: "Composio API key not configured",
    })))
  );

  // Persist a HistoryEvent so Hermes cron summaries can read what happened.
  try {
    const ok = results.filter((r) => r.status === "success" || r.status === "queued").length;
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
  // timing-safe compare
  const a = Buffer.from(token || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

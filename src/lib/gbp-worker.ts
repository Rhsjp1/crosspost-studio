import { db } from "@/lib/db";
import {
  GBP_PLATFORM,
  getValidAccessToken,
  createGbpPost,
  GbpPostInput,
} from "@/lib/gbp";

export type GbpPostResult = {
  status: "success" | "not_connected" | "error";
  post_name?: string;
  detail?: string;
};

/**
 * GBP worker: publish `text` to the connected business's default location.
 *
 * Steps:
 *  1. Find the `google_business` Connection for the user.
 *  2. Get a valid access token (refreshes if expired).
 *  3. Read accountId + defaultLocationId from accountName JSON.
 *  4. Create a Local Post via the GBP API.
 *
 * `locationId` may be overridden to target a non-default location.
 */
export async function postToGbp(
  userId: string,
  input: GbpPostInput,
  locationIdOverride?: string
): Promise<GbpPostResult> {
  const conn = await db.connection.findFirst({
    where: { platform: GBP_PLATFORM, userId, status: "connected" },
  });
  if (!conn) {
    return { status: "not_connected", detail: "No connected Google Business profile" };
  }

  try {
    const accessToken = await getValidAccessToken(conn);
    const meta = JSON.parse(conn.accountName || "{}") as {
      accountId?: string;
      defaultLocationId?: string;
    };
    const accountId = meta.accountId;
    const locationId = locationIdOverride || meta.defaultLocationId;
    if (!accountId || !locationId) {
      return { status: "error", detail: "Connection missing accountId or locationId" };
    }

    const res = await createGbpPost(accessToken, accountId, locationId, input);
    return { status: "success", post_name: res.name };
  } catch (err) {
    return { status: "error", detail: String(err).slice(0, 300) };
  }
}

/** Persist a GBP post attempt to history (mirrors crosspost history logging). */
export async function logGbpPost(details: Record<string, unknown>): Promise<void> {
  try {
    await db.historyEvent.create({
      data: { action: "gbp_post", details: JSON.stringify(details) },
    });
  } catch {
    // non-fatal
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { postToGbp, logGbpPost } from "@/lib/gbp-worker";

// POST /api/gbp/post
// Publish a Google Business Profile post. Auth: Bearer CROSSPOST_API_TOKEN
// (same token as /api/post) so Hermes crons can call both uniformly.
const Body = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).max(1500),
  link_url: z.string().url().optional(),
  media_url: z.string().url().optional(),
  callToActionType: z.string().optional(),
  locationId: z.string().optional(),
});

function authorized(authHeader: string | null): boolean {
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

export async function POST(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid body", detail: String(e) }, { status: 400 });
  }

  const result = await postToGbp(body.userId, {
    text: body.text,
    link_url: body.link_url,
    media_url: body.media_url,
    callToActionType: body.callToActionType,
  }, body.locationId);

  await logGbpPost({ ...body, result });
  return NextResponse.json(result, { status: result.status === "success" ? 200 : 207 });
}

// GET /api/gbp/post?userId=... — quick connectivity check
export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  const result = await postToGbp(userId, { text: "✅ GBP connectivity check" });
  return NextResponse.json(result);
}

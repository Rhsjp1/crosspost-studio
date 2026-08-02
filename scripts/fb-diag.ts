// scripts/fb-diag.ts
// Diagnostic: replicate crosspost.ts FB execute call to Composio and print the
// FULL raw response body (not just post_id). This tells us whether Meta
// actually published, vs. a silent no-op.
//
// This posts a LABELED TEST to the live RHS Page — run only with user go-ahead.
import { db } from "@/lib/db";

const COMPOSIO_BASE = "https://backend.composio.dev";
const ENTITY_ID = "righthandservicesbyjp@gmail.com";

async function getComposioApiKey(): Promise<string | null> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: "COMPOSIO_API_KEY" } });
    return row?.value || process.env.COMPOSIO_API_KEY || null;
  } catch {
    return process.env.COMPOSIO_API_KEY || null;
  }
}

async function main() {
  const apiKey = await getComposioApiKey();
  if (!apiKey) { console.error("no Composio key"); process.exit(1); }

  const conn = await db.connection.findFirst({
    where: { platform: "facebook", status: "connected" },
    orderBy: { updatedAt: "desc" },
  });
  if (!conn) { console.error("no FB connection"); process.exit(1); }

  let meta: any = {};
  try { meta = JSON.parse(conn.accountName || "{}"); } catch {}
  const pageId = meta.pageId;

  const text = `DIAGNOSTIC TEST ${new Date().toISOString()} — please ignore`;
  // Omit connected_account_id (like crosspost.ts) so Composio auto-resolves the
// connection for the entity — avoids code 1812 entity mismatch.
  const body = {
    entity_id: ENTITY_ID,
    arguments: {
      message: text,
      ...(pageId ? { page_id: pageId } : {}),
    },
  };

  console.log("POST", `${COMPOSIO_BASE}/api/v3/tools/execute/FACEBOOK_CREATE_POST`);
  console.log("payload:", JSON.stringify(body, null, 2));

  const res = await fetch(`${COMPOSIO_BASE}/api/v3/tools/execute/FACEBOOK_CREATE_POST`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  console.log("HTTP", res.status);
  console.log("RAW BODY:", raw);
}

main().catch((e) => { console.error(e); process.exit(1); });

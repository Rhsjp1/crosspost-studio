// scripts/update-fb-connection.ts
// Swap the old FB Composio connected_account_id for a freshly re-auth'd one,
// preserving the existing pageId / alias / isDefault flags.
//
// Run AFTER you have re-auth'd Facebook in Composio with pages_manage_posts
// scope and obtained the NEW connected_account_id.
//
// Usage:
//   NEW_FB_ID=ca_XXXX npx tsx scripts/update-fb-connection.ts
import { db } from "@/lib/db";

const OLD_ID = "ca_pD6Q9cCY6VwF"; // current (broken permission) accountId
const NEW_ID = process.env.NEW_FB_ID; // e.g. ca_abc123...
// Canonical RHS brand Page (confirmed from FB dashboard). The old DB value
// 1570446317784234 was STALE/WRONG — not one of the real Pages, which is why
// Graph returned subcode 33. Real Pages: 241304666368809 (RHS By JP, main),
// 428433487011596 (EclecticEchoes-JPII), 801346543070013 (RHSJP Products).
const PAGE_ID = process.env.FB_PAGE_ID || "241304666368809"; // RHS main Page

async function main() {
  if (!NEW_ID) {
    console.error("Set NEW_FB_ID env var to the new connected_account_id");
    process.exit(1);
  }

  const conn = await db.connection.findFirst({
    where: { platform: "facebook", accountId: OLD_ID },
  });
  if (!conn) {
    console.error(`No FB connection row found for accountId ${OLD_ID}`);
    process.exit(1);
  }

  let meta: any = {};
  try {
    meta = JSON.parse(conn.accountName || "{}");
  } catch {
    meta = {};
  }

  // Preserve existing wiring; ensure the required fields are present.
  meta.pageId = meta.pageId || PAGE_ID;
  meta.alias = meta.alias || "main";
  meta.isDefault = meta.isDefault ?? true;

  await db.connection.update({
    where: { id: conn.id },
    data: {
      accountId: NEW_ID,
      accountName: JSON.stringify(meta),
    },
  });

  console.log(`Updated FB connection row ${conn.id}:`);
  console.log(`  accountId: ${OLD_ID} -> ${NEW_ID}`);
  console.log(`  accountName: ${JSON.stringify(meta)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

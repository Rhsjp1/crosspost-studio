import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: fetch all app settings (key-value pairs)
export async function GET() {
  try {
    const rows = await db.appSetting.findMany();
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[settings GET]", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST: upsert one or more settings
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Support single key-value or multiple
    const entries: Array<[string, string]> = [];
    if (body.key && body.value !== undefined) {
      entries.push([body.key, String(body.value)]);
    } else {
      // Bulk: { COMPOSIO_API_KEY: "...", GHL_API_KEY: "..." }
      for (const [k, v] of Object.entries(body)) {
        if (typeof k === "string" && v !== undefined) {
          entries.push([k, String(v)]);
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    for (const [key, value] of entries) {
      await db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // If deleting a key (value is empty string), remove it
    for (const [key, value] of entries) {
      if (value === "") {
        await db.appSetting.delete({ where: { key } }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, updated: entries.length });
  } catch (error) {
    console.error("[settings POST]", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

// DELETE: remove a setting by key
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }
    await db.appSetting.delete({ where: { key } }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[settings DELETE]", error);
    return NextResponse.json({ error: "Failed to delete setting" }, { status: 500 });
  }
}

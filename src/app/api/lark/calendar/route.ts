import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize } from "@/lib/lark-cli";

// ─── GET /api/lark/calendar ─── List agenda / events ────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "agenda";

    let args: string[];
    if (view === "events") {
      args = ["calendar", "events", "list", "--jq", "."];
    } else {
      args = ["calendar", "+agenda", "--jq", "."];
    }

    const output = execLarkCli(args);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ─── POST /api/lark/calendar ─── Create event ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, startTime, endTime, attendees } = body as {
      title?: string;
      startTime?: string;
      endTime?: string;
      attendees?: string[];
    };

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields: title, startTime, endTime" },
        { status: 400 },
      );
    }

    const args: string[] = [
      "calendar",
      "events",
      "create",
      "--title", sanitize(title),
      "--start-time", sanitize(startTime),
      "--end-time", sanitize(endTime),
      "--jq", ".",
    ];

    if (attendees && Array.isArray(attendees)) {
      for (const email of attendees) {
        args.push("--attendee", sanitize(email));
      }
    }

    const output = execLarkCli(args);
    return NextResponse.json({ output }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

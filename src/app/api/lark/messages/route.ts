import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize } from "@/lib/lark-cli";

// ─── GET /api/lark/messages ─── Search messages ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    if (!q) {
      // Return empty list instead of 400 when no query provided
      return NextResponse.json({ output: [] });
    }

    const args: string[] = [
      "im",
      "messages",
      "search",
      "--query", sanitize(q),
      "--jq", ".",
    ];

    const output = execLarkCli(args);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ─── POST /api/lark/messages ─── Send message ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, text, type } = body as {
      chatId?: string;
      text?: string;
      type?: string;
    };

    if (!chatId || !text) {
      return NextResponse.json(
        { error: "Missing required fields: chatId, text" },
        { status: 400 },
      );
    }

    const msgType = type || "text";

    const args: string[] = [
      "im",
      "messages",
      "send",
      "--chat-id", sanitize(chatId),
      "--msg-type", sanitize(msgType),
      "--content", sanitize(text),
      "--jq", ".",
    ];

    const output = execLarkCli(args);
    return NextResponse.json({ output }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

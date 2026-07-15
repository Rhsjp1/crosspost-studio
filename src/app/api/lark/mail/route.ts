import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize } from "@/lib/lark-cli";

// ─── GET /api/lark/mail ─── List unread emails ──────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const folder = url.searchParams.get("folder") || "INBOX";

    const args: string[] = [
      "mail",
      "user_mailbox.messages",
      "list",
      "--user-mailbox-id", "me",
      "--folder-id", sanitize(folder),
      "--jq", ".",
    ];

    const output = execLarkCli(args);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ─── POST /api/lark/mail ─── Send email ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, body: emailBody, replyToMessageId } = body as {
      to?: string | string[];
      subject?: string;
      body?: string;
      replyToMessageId?: string;
    };

    if (!to || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 },
      );
    }

    const args: string[] = [
      "mail",
      "user_mailbox.messages",
      "send",
      "--user-mailbox-id", "me",
      "--subject", sanitize(subject),
      "--jq", ".",
    ];

    // Handle single recipient or array
    const recipients = Array.isArray(to) ? to : [to];
    for (const recipient of recipients) {
      args.push("--to", sanitize(recipient));
    }

    if (emailBody) {
      args.push("--body", sanitize(emailBody));
    }

    if (replyToMessageId) {
      args.push("--reply-to-message-id", sanitize(replyToMessageId));
    }

    const output = execLarkCli(args);
    return NextResponse.json({ output }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

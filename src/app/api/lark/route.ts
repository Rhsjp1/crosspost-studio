import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize, validateCommand } from "@/lib/lark-cli";

// ─── GET /api/lark ─── Status check ────────────────────────────────────────
export async function GET() {
  try {
    const output = execLarkCli(["whoami"]);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ─── POST /api/lark ─── Execute any allowed lark-cli command ────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, args, dryRun } = body as {
      command?: string;
      args?: string[];
      dryRun?: boolean;
    };

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'command' field" },
        { status: 400 },
      );
    }

    // Validate domain
    const domain = validateCommand(command);
    if (!domain) {
      return NextResponse.json(
        {
          error: `Command domain not allowed. Must start with one of: ${[...new Set(["im", "docs", "drive", "sheets", "base", "calendar", "meetings", "minutes", "mail", "tasks", "wiki", "contacts", "slides", "whiteboard", "okr", "approval", "attendance", "apps", "event", "api"])].join(", ")}`,
        },
        { status: 403 },
      );
    }

    // Build CLI args
    const cliArgs: string[] = command.trim().split(/\s+/);

    if (dryRun) {
      cliArgs.push("--dry-run");
    }

    if (args && Array.isArray(args)) {
      for (const arg of args) {
        if (typeof arg !== "string") continue;
        cliArgs.push(sanitize(arg));
      }
    }

    // Always request structured JSON output
    cliArgs.push("--jq", ".");

    const output = execLarkCli(cliArgs);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

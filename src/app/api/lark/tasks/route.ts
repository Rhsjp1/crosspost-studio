import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize } from "@/lib/lark-cli";

// ─── GET /api/lark/tasks ─── List tasks ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "20";

    const args: string[] = [
      "task",
      "task",
      "list",
      "--page-size", sanitize(limit),
      "--jq", ".",
    ];

    const output = execLarkCli(args);
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ─── POST /api/lark/tasks ─── Create task ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, dueDate } = body as {
      title?: string;
      description?: string;
      dueDate?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 },
      );
    }

    const args: string[] = [
      "task",
      "task",
      "create",
      "--name", sanitize(title),
      "--jq", ".",
    ];

    if (description) {
      args.push("--description", sanitize(description));
    }

    if (dueDate) {
      args.push("--due-date", sanitize(dueDate));
    }

    const output = execLarkCli(args);
    return NextResponse.json({ output }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

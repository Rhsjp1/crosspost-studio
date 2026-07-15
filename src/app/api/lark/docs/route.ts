import { NextRequest, NextResponse } from "next/server";
import { execLarkCli, sanitize } from "@/lib/lark-cli";

// ─── GET /api/lark/docs ─── List recent documents ───────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "20";

    const args: string[] = [
      "docs",
      "documents",
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

// ─── POST /api/lark/docs ─── Create document ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, folderToken } = body as {
      title?: string;
      content?: string;
      folderToken?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 },
      );
    }

    const args: string[] = [
      "docs",
      "+create",
      "--title", sanitize(title),
      "--jq", ".",
    ];

    if (content) {
      args.push("--content", sanitize(content));
    }

    if (folderToken) {
      args.push("--folder-token", sanitize(folderToken));
    }

    const output = execLarkCli(args);
    return NextResponse.json({ output }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

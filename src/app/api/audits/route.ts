import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { auditRunSchema } from "@/lib/schemas";
import { safeHttpUrl, parseAuditResult } from "@/lib/audits";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await db.auditRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("GET /api/audits error:", error);
    return NextResponse.json({ error: "Failed to fetch audits" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = auditRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, url: rawUrl } = parsed.data;

    // SSRF protection
    const safe = safeHttpUrl(rawUrl);
    if (!safe.ok || !safe.url) {
      return NextResponse.json({ error: safe.error || "Invalid URL" }, { status: 400 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    // Fetch the URL for auditing
    let resultRaw: string;
    try {
      const fetchRes = await fetch(safe.url.href, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": "CrosspostStudio-AuditBot/1.0",
        },
      });

      const html = await fetchRes.text();

      // Simple heuristic audits based on type
      const findings: string[] = [];

      if (type === "seo") {
        findings.push(`HTTP status: ${fetchRes.status}`);
        findings.push(`Content-Length: ${html.length} bytes`);
        if (!html.includes("<title")) findings.push("Missing <title> tag");
        if (!html.includes("<meta")) findings.push("Missing <meta> tags");
        if (!html.includes("<h1") && !html.includes("<h2"))
          findings.push("Missing heading tags (h1/h2)");
        findings.push(`HTML size: ${(html.length / 1024).toFixed(1)}KB`);
        const score = fetchRes.status === 200
          ? Math.min(100, 60 + (html.includes("<title") ? 15 : 0) + (html.includes("<meta") ? 15 : 0) + (html.includes("<h1") || html.includes("<h2") ? 10 : 0))
          : 20;
        resultRaw = JSON.stringify({ score, findings });
      } else if (type === "accessibility") {
        findings.push(`HTTP status: ${fetchRes.status}`);
        findings.push(`Content-Length: ${html.length} bytes`);
        const hasAlt = /alt=["'][^"']+["']/i.test(html);
        if (!hasAlt) findings.push("Images missing alt attributes");
        const hasAria = /aria-/i.test(html);
        if (!hasAria) findings.push("No ARIA attributes found");
        const hasLabel = /<label/i.test(html);
        if (!hasLabel) findings.push("No <label> elements found");
        const score = fetchRes.status === 200
          ? Math.min(100, 50 + (hasAlt ? 20 : 0) + (hasAria ? 20 : 0) + (hasLabel ? 10 : 0))
          : 20;
        resultRaw = JSON.stringify({ score, findings });
      } else if (type === "performance") {
        const start = Date.now();
        await fetch(safe.url.href, { signal: AbortSignal.timeout(10_000) });
        const loadMs = Date.now() - start;
        findings.push(`Load time: ${loadMs}ms`);
        findings.push(`Content-Length: ${html.length} bytes`);
        const score = loadMs < 1000 ? 90 : loadMs < 3000 ? 60 : loadMs < 5000 ? 40 : 20;
        resultRaw = JSON.stringify({ score, findings });
      } else if (type === "security") {
        findings.push(`HTTP status: ${fetchRes.status}`);
        const hasCSP = /content-security-policy/i.test(fetchRes.headers.get("content-security-policy") || "");
        if (!hasCSP) findings.push("Missing Content-Security-Policy header");
        const hasXFrame = fetchRes.headers.get("x-frame-options") ? true : false;
        if (!hasXFrame) findings.push("Missing X-Frame-Options header");
        const isHttps = safe.url.protocol === "https:";
        if (!isHttps) findings.push("Not using HTTPS");
        const score = isHttps ? 70 : 30;
        resultRaw = JSON.stringify({ score, findings });
      } else {
        // links audit
        const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          links.push(match[1]);
        }
        findings.push(`Found ${links.length} links`);
        findings.push(`Unique domains: ${new Set(links.map((l) => new URL(l).hostname)).size}`);
        const score = links.length > 0 ? 70 : 30;
        resultRaw = JSON.stringify({ score, findings, linksCount: links.length });
      }
    } catch (fetchError) {
      resultRaw = JSON.stringify({
        score: 0,
        findings: [`Failed to fetch URL: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`],
      });
    }

    const { score, findings } = parseAuditResult(resultRaw);

    const auditRun = await db.auditRun.create({
      data: {
        type,
        url: safe.url.href,
        result: resultRaw,
        score,
        findings: JSON.stringify(findings),
        userId,
      },
    });

    return NextResponse.json(auditRun, { status: 201 });
  } catch (error) {
    console.error("POST /api/audits error:", error);
    return NextResponse.json({ error: "Failed to run audit" }, { status: 500 });
  }
}

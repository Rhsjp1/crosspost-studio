import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { auditRunSchema } from "@/lib/schemas";
import { safeHttpUrl, parseAuditResult, type Finding } from "@/lib/audits";

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

// ── Shared helpers ─────────────────────────────────────────────────

function extractMeta(html: string, name: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

function extractMetaContent(html: string): string | null {
  const m = html.match(/<meta[^>]*charset=["']?([^"'>\s]+)/i);
  return m ? m[1] : null;
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length;
}

function hasMetaTag(html: string, name: string): boolean {
  return new RegExp(`<meta[^>]*(?:name|property)=["']${name}["']`, "i").test(html);
}

interface FetchData {
  html: string;
  headers: Headers;
  status: number;
  loadMs: number;
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
      const t0 = Date.now();
      const fetchRes = await fetch(safe.url.href, {
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "CrosspostStudio-AuditBot/1.0" },
      });
      const html = await fetchRes.text();
      const loadMs = Date.now() - t0;
      const data: FetchData = { html, headers: fetchRes.headers, status: fetchRes.status, loadMs };

      const findings: Finding[] = [];

      if (type === "seo") {
        findings.push(...auditSEO(data, safe.url));
      } else if (type === "accessibility") {
        findings.push(...auditAccessibility(data));
      } else if (type === "performance") {
        findings.push(...auditPerformance(data, safe.url));
      } else if (type === "security") {
        findings.push(...auditSecurity(data, safe.url));
      } else {
        findings.push(...auditLinks(data, safe.url));
      }

      const score = computeScore(findings);
      resultRaw = JSON.stringify({ score, findings });
    } catch (fetchError) {
      resultRaw = JSON.stringify({
        score: 0,
        findings: [{ category: "Fetch", status: "fail", message: `Failed to fetch URL: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}` }],
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

// ── Score helper ──────────────────────────────────────────────────
function computeScore(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.status === "fail") score -= 12;
    else if (f.status === "warn") score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

// ── SEO Audit ─────────────────────────────────────────────────────
function auditSEO(data: FetchData, url: URL): Finding[] {
  const { html, status, headers } = data;
  const f: Finding[] = [];

  // Technical SEO
  const catT = "Technical SEO";
  f.push({ category: catT, status: status === 200 ? "pass" : "fail", message: `HTTP status: ${status}` });
  const robots = extractMeta(html, "robots");
  if (robots && /noindex/i.test(robots)) {
    f.push({ category: catT, status: "fail", message: `Robots meta tag set to noindex — page won't be indexed` });
  } else {
    f.push({ category: catT, status: "pass", message: "No noindex directives blocking indexing" });
  }
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  if (canonical) {
    f.push({ category: catT, status: "pass", message: `Canonical URL present: ${canonical[1]}` });
  } else {
    f.push({ category: catT, status: "warn", message: "Missing canonical link tag" });
  }
  const contentType = headers.get("content-type") || "";
  f.push({ category: catT, status: contentType.includes("text/html") ? "pass" : "warn", message: `Content-Type: ${contentType || "missing"}` });
  f.push({ category: catT, status: "info", message: `Page size: ${(html.length / 1024).toFixed(1)}KB` });

  // On-Page SEO
  const catO = "On-Page SEO";
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : "";
  if (!titleText) {
    f.push({ category: catO, status: "fail", message: "Missing <title> tag" });
  } else {
    const tl = titleText.length;
    if (tl > 60) f.push({ category: catO, status: "warn", message: `Title tag is ${tl} chars — ideally 50-60` });
    else if (tl < 30) f.push({ category: catO, status: "warn", message: `Title tag is only ${tl} chars — consider more descriptive (aim 50-60)` });
    else f.push({ category: catO, status: "pass", message: `Title tag (${tl} chars): "${titleText}"` });
  }
  const desc = extractMeta(html, "description");
  if (!desc) {
    f.push({ category: catO, status: "fail", message: "Missing meta description" });
  } else {
    const dl = desc.length;
    if (dl > 160) f.push({ category: catO, status: "warn", message: `Meta description is ${dl} chars — ideally 150-160` });
    else if (dl < 70) f.push({ category: catO, status: "warn", message: `Meta description is only ${dl} chars — consider expanding (aim 150-160)` });
    else f.push({ category: catO, status: "pass", message: `Meta description (${dl} chars): "${desc.substring(0, 80)}..."` });
  }
  const h1Count = countMatches(html, /<h1[^>]*>/gi);
  if (h1Count === 0) f.push({ category: catO, status: "fail", message: "No H1 heading found" });
  else if (h1Count > 1) f.push({ category: catO, status: "warn", message: `${h1Count} H1 tags found — should have exactly one` });
  else f.push({ category: catO, status: "pass", message: "Exactly one H1 heading present" });
  const h2Count = countMatches(html, /<h2[^>]*>/gi);
  f.push({ category: catO, status: h2Count > 0 ? "pass" : "warn", message: `${h2Count} H2 headings found` });
  const h3Count = countMatches(html, /<h3[^>]*>/gi);
  f.push({ category: catO, status: "info", message: `${h3Count} H3 headings found` });

  // Content Quality
  const catC = "Content Quality";
  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) f.push({ category: catC, status: "warn", message: `Only ~${wordCount} words of visible text — thin content risk (aim 300+ for topical pages)` });
  else f.push({ category: catC, status: "pass", message: `~${wordCount} words of visible text content` });
  const imgCount = countMatches(html, /<img[^>]+>/gi);
  const imgWithAlt = countMatches(html, /<img[^>]+alt=["'][^"']+["']/gi);
  if (imgCount > 0 && imgWithAlt < imgCount) {
    f.push({ category: catC, status: "warn", message: `${imgCount - imgWithAlt} of ${imgCount} images missing alt text` });
  } else if (imgCount > 0) {
    f.push({ category: catC, status: "pass", message: `All ${imgCount} images have alt text` });
  } else {
    f.push({ category: catC, status: "info", message: "No images found on page" });
  }

  // Social / Open Graph
  const catS = "Social & Rich Snippets";
  const ogTitle = hasMetaTag(html, "og:title");
  const ogDesc = hasMetaTag(html, "og:description");
  const ogImage = hasMetaTag(html, "og:image");
  const twCard = hasMetaTag(html, "twitter:card");
  const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  if (ogCount === 3 && twCard) {
    f.push({ category: catS, status: "pass", message: "Complete Open Graph + Twitter Card meta tags present" });
  } else {
    if (!ogTitle) f.push({ category: catS, status: "warn", message: "Missing og:title meta tag" });
    if (!ogDesc) f.push({ category: catS, status: "warn", message: "Missing og:description meta tag" });
    if (!ogImage) f.push({ category: catS, status: "warn", message: "Missing og:image meta tag" });
    if (!twCard) f.push({ category: catS, status: "warn", message: "Missing twitter:card meta tag" });
  }
  const schema = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (schema) {
    f.push({ category: catS, status: "pass", message: "Structured data (JSON-LD schema) detected" });
  } else {
    f.push({ category: catS, status: "warn", message: "No structured data (JSON-LD schema) found — limits rich snippets in search results" });
  }

  // Local SEO
  const catL = "Local SEO";
  f.push({ category: catL, status: "info", message: `Domain: ${url.hostname}` });
  if (hasMetaTag(html, "geo.region") || hasMetaTag(html, "geo.placename")) {
    f.push({ category: catL, status: "pass", message: "Geo meta tags detected (geo.region / geo.placename)" });
  } else {
    f.push({ category: catL, status: "info", message: "No geo-targeting meta tags — add geo.region/geo.placename if targeting local search" });
  }

  return f;
}

// ── Accessibility Audit ──────────────────────────────────────────
function auditAccessibility(data: FetchData): Finding[] {
  const { html, status } = data;
  const f: Finding[] = [];

  // HTML Structure
  const catH = "HTML Structure";
  f.push({ category: catH, status: status === 200 ? "pass" : "fail", message: `HTTP status: ${status}` });
  const hasDoctype = /^\s*<!doctype/i.test(html);
  f.push({ category: catH, status: hasDoctype ? "pass" : "fail", message: hasDoctype ? "DOCTYPE declaration present" : "Missing <!DOCTYPE> — quirks mode risk" });
  const langAttr = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  f.push({ category: catH, status: langAttr ? "pass" : "warn", message: langAttr ? `Language attribute: "${langAttr[1]}"` : "Missing lang attribute on <html> — screen readers can't determine language" });
  const charset = extractMetaContent(html) || html.match(/<meta[^>]*charset=["']?([^"'>\s]+)/i)?.[1];
  f.push({ category: catH, status: charset ? "pass" : "warn", message: charset ? `Charset declared: ${charset}` : "No charset meta tag found" });

  // Images & Alt Text
  const catI = "Images & Alt Text";
  const imgTotal = countMatches(html, /<img[^>]+>/gi);
  const imgNoAlt = countMatches(html, /<img[^>]+(?!alt=)[^>]*>/gi);
  const imgEmptyAlt = countMatches(html, /<img[^>]+alt=["']["']/gi);
  const imgWithAlt = countMatches(html, /<img[^>]+alt=["'][^"']+["']/gi);
  if (imgTotal === 0) {
    f.push({ category: catI, status: "info", message: "No images on page" });
  } else {
    if (imgNoAlt > 0) f.push({ category: catI, status: "fail", message: `${imgNoAlt} image(s) with no alt attribute at all` });
    if (imgEmptyAlt > 0) f.push({ category: catI, status: "warn", message: `${imgEmptyAlt} image(s) with empty alt="" — OK for decorative only, ensure intentional` });
    if (imgWithAlt > 0) f.push({ category: catI, status: "pass", message: `${imgWithAlt} image(s) with descriptive alt text` });
  }

  // ARIA & Labels
  const catA = "ARIA & Form Labels";
  const ariaCount = countMatches(html, /aria-/gi);
  f.push({ category: catA, status: ariaCount > 0 ? "pass" : "info", message: ariaCount > 0 ? `${ariaCount} ARIA attribute(s) found` : "No ARIA attributes — add for dynamic content or custom widgets" });
  const labels = countMatches(html, /<label[^>]*>/gi);
  const inputs = countMatches(html, /<input[^>]*>/gi);
  const buttons = countMatches(html, /<button[^>]*>/gi);
  if (inputs > 0 && labels === 0) {
    f.push({ category: catA, status: "fail", message: `${inputs} input field(s) but zero <label> elements — forms are inaccessible to screen readers` });
  } else if (inputs > 0 && labels < inputs) {
    f.push({ category: catA, status: "warn", message: `${labels} label(s) for ${inputs} input(s) — some fields may lack proper labels` });
  } else if (inputs > 0) {
    f.push({ category: catA, status: "pass", message: `All ${inputs} input field(s) have associated labels` });
  } else {
    f.push({ category: catA, status: "info", message: "No form input fields on page" });
  }
  const btnAriaLabel = countMatches(html, /<button[^>]*aria-label=/gi);
  if (buttons > 0) f.push({ category: catA, status: "info", message: `${buttons} button(s) found, ${btnAriaLabel} with aria-label` });

  // Keyboard Navigation
  const catK = "Keyboard Navigation";
  const tabIndexPos = countMatches(html, /tabindex=["'][1-9]/gi);
  if (tabIndexPos > 0) {
    f.push({ category: catK, status: "warn", message: `${tabIndexPos} element(s) with positive tabindex — disrupts natural keyboard navigation order` });
  } else {
    f.push({ category: catK, status: "pass", message: "No positive tabindex values that disrupt tab order" });
  }
  const skipLink = html.match(/<a[^>]*href=["']#[^"']*["'][^>]*>(?:skip|jump)/i);
  f.push({ category: catK, status: skipLink ? "pass" : "info", message: skipLink ? "Skip-to-content link detected" : "No skip-to-content link — keyboard users must tab through entire nav" });

  // Heading Hierarchy
  const catHH = "Heading Hierarchy";
  const h1 = countMatches(html, /<h1[^>]*>/gi);
  const h2 = countMatches(html, /<h2[^>]*>/gi);
  const h3 = countMatches(html, /<h3[^>]*>/gi);
  const h4 = countMatches(html, /<h4[^>]*>/gi);
  f.push({ category: catHH, status: h1 === 1 ? "pass" : h1 === 0 ? "fail" : "warn", message: `${h1} H1 heading(s) — should be exactly 1` });
  f.push({ category: catHH, status: "info", message: `Heading structure: H1(${h1}) → H2(${h2}) → H3(${h3}) → H4(${h4})` });
  if (h2 > 0 && h1 === 0) f.push({ category: catHH, status: "fail", message: "H2 headings present but no H1 — heading hierarchy is broken" });

  // Color Contrast (heuristic — can't measure without CSS)
  const catC = "Color & Contrast";
  const inlineStyles = countMatches(html, /style=["'][^"']*color/gi);
  f.push({ category: catC, status: "info", message: `${inlineStyles} inline color style(s) — manual contrast verification needed (WCAG 2.2 AA: 4.5:1 ratio for normal text)` });

  return f;
}

// ── Performance Audit ────────────────────────────────────────────
function auditPerformance(data: FetchData, url: URL): Finding[] {
  const { html, headers, status, loadMs } = data;
  const f: Finding[] = [];

  // Core Web Vitals (proxy measures)
  const catCW = "Core Web Vitals";
  f.push({ category: catCW, status: status === 200 ? "pass" : "fail", message: `HTTP status: ${status}` });
  if (loadMs <= 2500) {
    f.push({ category: catCW, status: "pass", message: `LCP proxy (TTFB + download): ${loadMs}ms — under 2.5s target` });
  } else if (loadMs <= 4000) {
    f.push({ category: catCW, status: "warn", message: `LCP proxy: ${loadMs}ms — above 2.5s target, needs improvement` });
  } else {
    f.push({ category: catCW, status: "fail", message: `LCP proxy: ${loadMs}ms — exceeds 4s, poor loading performance` });
  }

  // Resource Analysis
  const catR = "Resource Analysis";
  const pageSize = html.length;
  f.push({ category: catR, status: pageSize < 500_000 ? "pass" : pageSize < 1_500_000 ? "warn" : "fail", message: `HTML size: ${(pageSize / 1024).toFixed(1)}KB` });
  const scripts = countMatches(html, /<script[^>]*>/gi);
  const inlineScripts = countMatches(html, /<script[^>]*>(?!<\s*\/)/gi);
  f.push({ category: catR, status: scripts > 10 ? "warn" : "info", message: `${scripts} <script> tag(s), ${inlineScripts} inline (render-blocking if not async/defer)` });
  const asyncDefer = countMatches(html, /<script[^>]*(?:async|defer)/gi);
  f.push({ category: catR, status: scripts > 0 && asyncDefer === 0 ? "warn" : "pass", message: `${asyncDefer} of ${scripts} scripts use async/defer` });
  const stylesheets = countMatches(html, /<link[^>]*rel=["']stylesheet["']/gi);
  f.push({ category: catR, status: stylesheets > 3 ? "warn" : "info", message: `${stylesheets} stylesheet(s) — each is a render-blocking request` });
  const imgTotal = countMatches(html, /<img[^>]+>/gi);
  const lazyImgs = countMatches(html, /<img[^>]+loading=["']lazy["']/gi);
  f.push({ category: catR, status: imgTotal > 0 && lazyImgs === 0 ? "warn" : "pass", message: `${lazyImgs} of ${imgTotal} images use loading="lazy"` });

  // Caching & Compression
  const catC = "Caching & Compression";
  const encoding = headers.get("content-encoding") || "";
  f.push({ category: catC, status: encoding ? "pass" : "warn", message: encoding ? `Content encoding: ${encoding}` : "No content-encoding — responses not compressed (gzip/brotli)" });
  const cacheControl = headers.get("cache-control") || "";
  f.push({ category: catC, status: cacheControl ? "pass" : "warn", message: cacheControl ? `Cache-Control: ${cacheControl}` : "No Cache-Control header — browsers can't cache responses efficiently" });
  const etag = headers.get("etag");
  f.push({ category: catC, status: etag ? "pass" : "info", message: etag ? "ETag present — supports conditional requests" : "No ETag header" });

  // Mobile Friendliness
  const catM = "Mobile Friendliness";
  const viewport = hasMetaTag(html, "viewport");
  f.push({ category: catM, status: viewport ? "pass" : "fail", message: viewport ? "Viewport meta tag present" : "Missing viewport meta tag — site won't render correctly on mobile" });
  const mediaQueries = countMatches(html, /@media/gi);
  f.push({ category: catM, status: "info", message: `${mediaQueries} @media query rule(s) in inline styles` });

  return f;
}

// ── Security Audit ───────────────────────────────────────────────
function auditSecurity(data: FetchData, url: URL): Finding[] {
  const { headers, status } = data;
  const f: Finding[] = [];

  // HTTPS & Transport
  const catH = "HTTPS & Transport";
  const isHttps = url.protocol === "https:";
  f.push({ category: catH, status: isHttps ? "pass" : "fail", message: isHttps ? "Using HTTPS" : "Not using HTTPS — site is unencrypted" });
  f.push({ category: catH, status: status === 200 ? "pass" : "fail", message: `HTTP status: ${status}` });
  const hsts = headers.get("strict-transport-security") || "";
  f.push({ category: catH, status: hsts ? "pass" : "fail", message: hsts ? `HSTS: ${hsts}` : "Missing Strict-Transport-Security (HSTS) header — vulnerable to protocol downgrade attacks" });

  // Content Security
  const catC = "Content Security";
  const csp = headers.get("content-security-policy") || "";
  f.push({ category: catC, status: csp ? "pass" : "fail", message: csp ? `Content-Security-Policy: ${csp.substring(0, 80)}...` : "Missing Content-Security-Policy header — no protection against XSS and data injection" });
  const xcto = headers.get("x-content-type-options") || "";
  f.push({ category: catC, status: xcto ? "pass" : "warn", message: xcto ? "X-Content-Type-Options: nosniff" : "Missing X-Content-Type-Options header — browser may MIME-sniff responses" });

  // Clickjacking Protection
  const catF = "Clickjacking Protection";
  const xfo = headers.get("x-frame-options") || "";
  const frameAncestors = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (xfo) {
    f.push({ category: catF, status: "pass", message: `X-Frame-Options: ${xfo}` });
  } else if (frameAncestors) {
    f.push({ category: catF, status: "pass", message: `CSP frame-ancestors directive: ${frameAncestors[1].trim()}` });
  } else {
    f.push({ category: catF, status: "fail", message: "Missing X-Frame-Options and no CSP frame-ancestors — vulnerable to clickjacking" });
  }

  // Referrer & Permissions
  const catR = "Referrer & Permissions";
  const referrer = headers.get("referrer-policy") || "";
  f.push({ category: catR, status: referrer ? "pass" : "warn", message: referrer ? `Referrer-Policy: ${referrer}` : "Missing Referrer-Policy header — full referrer URLs may leak to external sites" });
  const permissions = headers.get("permissions-policy") || "";
  f.push({ category: catR, status: permissions ? "pass" : "info", message: permissions ? `Permissions-Policy: ${permissions.substring(0, 80)}` : "No Permissions-Policy header — browser features (camera, geolocation, mic) unrestricted" });

  // Server Information Disclosure
  const catS = "Information Disclosure";
  const serverHdr = headers.get("server") || "";
  f.push({ category: catS, status: serverHdr ? "warn" : "pass", message: serverHdr ? `Server header exposes: "${serverHdr}" — helps attackers fingerprint your stack` : "No Server header — good, no version disclosure" });
  const xpb = headers.get("x-powered-by") || "";
  f.push({ category: catS, status: xpb ? "warn" : "pass", message: xpb ? `X-Powered-By exposes: "${xpb}" — remove this header` : "No X-Powered-By header — good" });

  return f;
}

// ── Links Audit ──────────────────────────────────────────────────
function auditLinks(data: FetchData, url: URL): Finding[] {
  const { html, status } = data;
  const f: Finding[] = [];

  // External Backlink Profile (what we can see from the page's outbound links)
  const catE = "External Links";
  f.push({ category: catE, status: status === 200 ? "pass" : "fail", message: `HTTP status: ${status}` });
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const allLinks: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) allLinks.push(match[1]);
  const external = allLinks.filter(l => { try { return new URL(l).hostname !== url.hostname } catch { return false } });
  const getHost = (l: string) => { try { return new URL(l).hostname } catch { return l } };
  const domains = [...new Set(external.map(getHost))];
  f.push({ category: catE, status: "info", message: `${external.length} external link(s) to ${domains.length} unique domain(s)` });
  if (domains.length > 0) f.push({ category: catE, status: "info", message: `External domains: ${domains.slice(0, 10).join(", ")}${domains.length > 10 ? "..." : ""}` });

  // Internal Link Architecture
  const catI = "Internal Link Architecture";
  const internal = allLinks.filter(l => { try { return new URL(l).hostname === url.hostname } catch { return false } });
  f.push({ category: catI, status: internal.length > 0 ? "pass" : "warn", message: `${internal.length} internal link(s) found` });
  const getPath = (l: string) => { try { return new URL(l).pathname } catch { return l } };
  const uniquePaths = [...new Set(internal.map(getPath))];
  f.push({ category: catI, status: "info", message: `${uniquePaths.length} unique internal path(s) linked` });

  // Broken Link Identification
  const catB = "Broken Link Indicators";
  const hashLinks = countMatches(html, /href=["']#[^"']*["']/gi);
  f.push({ category: catB, status: "info", message: `${hashLinks} anchor/hash link(s) — verify targets exist on page` });
  const javascriptLinks = countMatches(html, /href=["']javascript:/gi);
  if (javascriptLinks > 0) f.push({ category: catB, status: "warn", message: `${javascriptLinks} javascript: link(s) — not crawlable by search engines` });
  const nofollowLinks = countMatches(html, /rel=["'][^"']*\bnofollow\b/gi);
  f.push({ category: catB, status: "info", message: `${nofollowLinks} link(s) with rel="nofollow"` });

  // Link Quality
  const catQ = "Link Quality";
  const totalLinks = allLinks.length + hashLinks;
  const textLinks = countMatches(html, /<a[^>]*>[^<]+<\/a>/gi);
  const emptyLinks = totalLinks - textLinks;
  if (emptyLinks > 0) f.push({ category: catQ, status: "warn", message: `${emptyLinks} link(s) may have empty or image-only anchor text` });
  f.push({ category: catQ, status: totalLinks > 0 ? "pass" : "fail", message: `Total links on page: ${totalLinks}` });
  const linkRatio = totalLinks > 0 ? (external.length / totalLinks * 100).toFixed(0) : "0";
  f.push({ category: catQ, status: "info", message: `${linkRatio}% of links are external` });

  return f;
}

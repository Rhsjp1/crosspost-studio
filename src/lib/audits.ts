// SSRF protection: validate that a URL does not point to a private/internal IP
export function safeHttpUrl(raw: string): { ok: boolean; url?: URL; error?: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }

  // Block private/loopback/link-local ranges in hostname
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // IPv4 private ranges
  const ipv4Patterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,        // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
    /^192\.168\.\d{1,3}\.\d{1,3}$/,            // 192.168.0.0/16
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,        // 127.0.0.0/8
    /^169\.254\.\d{1,3}\.\d{1,3}$/,            // 169.254.0.0/16 link-local
    /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,          // 0.0.0.0/8
  ];

  for (const pattern of ipv4Patterns) {
    if (pattern.test(hostname)) {
      return { ok: false, error: "Private/internal IP addresses are not allowed" };
    }
  }

  // IPv6 private ranges (fc::/7 and fd::/8 + loopback ::1)
  const ipv6Patterns = [
    /^fc[0-9a-f]{2}:/i,  // fc00::/7
    /^fd[0-9a-f]{2}:/i,  // fd00::/8
    /^::$/,
    /^::1$/,
    /^fe80:/i,            // link-local
  ];

  for (const pattern of ipv6Patterns) {
    if (pattern.test(hostname)) {
      return { ok: false, error: "Private/internal IPv6 addresses are not allowed" };
    }
  }

  // Block common internal hostnames
  const blockedHosts = [
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
  ];

  if (blockedHosts.includes(hostname)) {
    return { ok: false, error: "Internal hostnames are not allowed" };
  }

  return { ok: true, url };
}

// Helper to parse raw audit result into structured findings
export function parseAuditResult(raw: string): {
  score: number;
  findings: string[];
} {
  let score = 0;
  const findings: string[] = [];

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.score === "number") {
      score = Math.max(0, Math.min(100, parsed.score));
    }
    if (Array.isArray(parsed.findings)) {
      for (const f of parsed.findings) {
        if (typeof f === "string") {
          findings.push(f);
        } else {
          findings.push(JSON.stringify(f));
        }
      }
    }
  } catch {
    // Non-JSON result: treat the whole string as a single finding, score 50
    score = 50;
    findings.push(raw || "Audit completed but no structured results available");
  }

  return { score, findings };
}

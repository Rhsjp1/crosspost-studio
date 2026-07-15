import { execSync } from "child_process";

/** Path to the lark-cli binary */
const LARK_CLI_BIN = process.env.LARK_CLI_BIN || "lark-cli";

/** Timeout for all CLI calls (ms) */
const CLI_TIMEOUT = 5_000;

/**
 * Allowed first-party domain prefixes for the generic POST endpoint.
 * Prevents arbitrary shell command injection.
 */
export const ALLOWED_DOMAINS = [
  "im",
  "docs",
  "drive",
  "sheets",
  "base",
  "calendar",
  "meetings",
  "minutes",
  "mail",
  "tasks",
  "wiki",
  "contacts",
  "slides",
  "whiteboard",
  "okr",
  "approval",
  "attendance",
  "apps",
  "event",
  "contact",
  "vc",
  "markdown",
  "application",
  "api",
  "auth",
  "config",
  "schema",
  "help",
  "whoami",
  "version",
] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

/**
 * Sanitize a user-supplied string for safe embedding in a shell command.
 * Escapes single quotes, double quotes, backticks, backslashes,
 * semicolons, dollar signs, and newlines.
 */
export function sanitize(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/"/g, '\\"')
    .replace(/`/g, "\\`")
    .replace(/;/g, "\\;")
    .replace(/\$/g, "\\$")
    .replace(/\n/g, " ");
}

/**
 * Validate that a command string starts with an allowed domain.
 * Returns the matched domain or null if invalid.
 */
export function validateCommand(command: string): AllowedDomain | null {
  const parts = command.trim().split(/\s+/);
  const first = parts[0] as string;
  return (ALLOWED_DOMAINS as readonly string[]).includes(first)
    ? (first as AllowedDomain)
    : null;
}

/**
 * Execute a lark-cli command and return parsed JSON output.
 *
 * @param args  - Array of arguments to pass to lark-cli (each already sanitized)
 * @returns Parsed JSON output from the CLI
 * @throws Error with stderr message on failure
 */
export function execLarkCli(args: string[]): unknown {
  const cmdParts = [LARK_CLI_BIN, ...args.map(sanitize)];
  const cmd = cmdParts.join(" ");

  try {
    const raw = execSync(cmd, {
      timeout: CLI_TIMEOUT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const trimmed = raw.trim();
    if (!trimmed) return null;

    return JSON.parse(trimmed);
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string; status?: number };
    const message =
      error.stderr?.trim() || error.message || "Unknown lark-cli error";
    throw new Error(`lark-cli exited ${error.status ?? "??"}: ${message}`);
  }
}

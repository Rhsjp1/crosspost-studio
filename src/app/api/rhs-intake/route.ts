import { NextRequest, NextResponse } from "next/server";

/**
 * RHS Lead Intake API
 *
 * POST /api/rhs-intake
 * Accepts lead data, calls Gemini AI for scoring/segmentation,
 * writes to Supabase rhs_leads table, returns tier + message.
 *
 * Body: { name, email, role, property_address?, notes? }
 * Response: { status, tier, segment, score, message }
 *
 * CORS: Allows cross-origin requests from Kalit and other frontends.
 *
 * AI provider: Google Gemini (free tier via AI Studio).
 * Env var: GEMINI_API_KEY
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
// Model fallback chain — newest stable first. New AI Studio projects get 404
// on any model marked "no longer available to new users" (2.0/2.5 flash family),
// so we try the current stable Gemini 3.x models first, then 2.5 flash-lite.
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface LeadInput {
  name: string;
  email: string;
  role: string;
  property_address?: string;
  notes?: string;
}

interface ScoredLead {
  tier: string;
  score: number;
  segment: string;
  pipeline_stage: string;
  next_action: string;
  internal_notes: string;
  message: string;
}

/** Handle CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Suggestion presets for common RHS lead types — used as a hint for Gemini
 *  and as a fallback when the heuristic runs without AI. */
function suggestSegment(lead: LeadInput): string | null {
  const role = (lead.role || "").toLowerCase();
  const notes = (lead.notes || "").toLowerCase();
  const addr = (lead.property_address || "").toLowerCase();

  // NC homeowner with drainage/flooding notes
  if (
    (role.includes("owner") || role.includes("homeowner")) &&
    /flood|drainage|erosion|standing water|wet yard|swale/i.test(notes)
  ) {
    return "Property Owner - High Drainage Risk";
  }

  // Local business — multi-property / parking lot / campus
  if (
    (role.includes("business") || role.includes("manager") || role.includes("hoa")) &&
    /parking|campus|complex|multi|commercial|hoa|tenant/i.test(notes)
  ) {
    return "Local Business - Multi-Property Maintenance";
  }

  // Investor or realtor with multiple addresses / transaction context
  if (
    (role.includes("investor") || role.includes("realtor") || role.includes("agent") || role.includes("broker")) &&
    /portfolio|multiple|buy|sell|listing|transaction|invest/i.test(notes)
  ) {
    return "Portfolio - Transaction Intelligence";
  }

  return null;
}

/** Tier playbooks — explicit next-action and pipeline stage per tier.
 *  This is the operational layer: when you open Supabase, you instantly
 *  know what to do with each record. */
function tierPlaybook(tier: string, segment: string): { pipeline_stage: string; next_action: string; internal_notes_template: string } {
  switch (tier) {
    case "A":
      return {
        pipeline_stage: "hot",
        next_action:
          segment.includes("Drainage") || segment.includes("Flood")
            ? "Call within 24 hours — offer on-site drainage assessment visit"
            : "Call within 24 hours — offer free property consultation",
        internal_notes_template: `HOT lead. AI score {score}/100 (tier A). Segment: ${segment}. Immediate outreach required.`,
      };
    case "B":
      return {
        pipeline_stage: "warm",
        next_action:
          segment.includes("Business") || segment.includes("Multi")
            ? "Send tailored maintenance package email, call in 48-72 hours"
            : segment.includes("Portfolio") || segment.includes("Realtor") || segment.includes("Transaction")
              ? "Send ROI/investment analysis email, call in 48-72 hours"
              : "Send tailored follow-up email with service info, call in 48-72 hours",
        internal_notes_template: `WARM lead. AI score {score}/100 (tier B). Segment: ${segment}. Needs nurturing + follow-up.`,
      };
    default:
      return {
        pipeline_stage: "nurture",
        next_action:
          "Add to educational email sequence (drainage tips, NC storm prep, maintenance guides); request more property details",
        internal_notes_template: `NURTURE lead. AI score {score}/100 (tier C). Segment: ${segment}. Low urgency — educate and re-engage.`,
      };
  }
}

/** Normalize Gemini's JSON output into our ScoredLead shape, enriched
 *  with tier playbooks and segment presets. */
function normalizeScoredLead(parsed: any, lead: LeadInput): ScoredLead {
  const tier = ["A", "B", "C"].includes(parsed.tier) ? parsed.tier : "C";
  const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));

  // Use Gemini's segment if it provided one, otherwise fall back to preset heuristic
  let segment = parsed.segment || "";
  if (!segment || segment.length < 5) {
    segment = suggestSegment(lead) || `${lead.role} – Lead`;
  }

  // Tier-aware message: prefer Gemini's custom message, but ensure it matches
  // the tier's urgency level. If Gemini's message is missing, use tier presets.
  const message =
    parsed.message ||
    (tier === "A"
      ? "We'll review your property and reach out within 24 hours with next steps."
      : tier === "B"
        ? "We'll review your details and follow up within 1-2 days with recommendations."
        : "Thanks for reaching out — please share a bit more about your property so we can better understand your situation.");

  const playbook = tierPlaybook(tier, segment);
  const internal_notes = playbook.internal_notes_template.replace("{score}", String(score));

  return {
    tier,
    score,
    segment,
    pipeline_stage: playbook.pipeline_stage,
    next_action: playbook.next_action,
    internal_notes,
    message,
  };
}

async function scoreLeadWithGemini(lead: LeadInput): Promise<ScoredLead> {
  const prompt = `
You are an AI lead scoring assistant for RHS AI Solutions, an AI-powered property and landscape intelligence service in North Carolina.

RHS AI Solutions provides:
- AI maintenance reporting
- Digital twin mapping of properties
- AI landscape analysis
- Predictive maintenance
- Sprinkler/irrigation design
- Square footage verification
- Drainage risk assessment
All AI outputs are reviewed by a human expert, James Person, before any client actions.

Your task:
Given a lead's details, evaluate how valuable this lead is for RHS AI Solutions and respond with a STRICT JSON object only.

Lead information:
- Name: ${lead.name}
- Email: ${lead.email}
- Role: ${lead.role}
- Property address: ${lead.property_address || "Not provided"}
- Notes: ${lead.notes || "None"}

Scoring rules:

1. "tier" must be one of:
   - "A" = high-value, strong fit, likely to convert soon
   - "B" = good fit, may need nurturing or more info
   - "C" = low fit, low urgency, or unclear needs

2. "score" is an integer from 0 to 100:
   - 80-100 = very strong lead
   - 60-79  = decent lead
   - 40-59  = weak lead
   - 0-39   = very low-quality or irrelevant

3. "segment" should describe the lead in 3-7 words.
   Examples:
   - "Property Owner - High Drainage Risk"
   - "Local Business - Multi-Property Maintenance"
   - "Realtor - Buyer/Seller Intelligence"
   - "Investor - Portfolio Property Assessment"

4. "message" is a short, friendly, plain-language response (1-3 sentences)
   that:
   - acknowledges what the lead said
   - reflects their role and concerns
   - tells them we will review their property and follow up within 24-48 hours
   - avoids making any guarantees or legal/engineering claims

IMPORTANT:
- Base your decision on the role, address, and notes.
- Prioritize North Carolina properties and people with drainage, flooding,
  maintenance, or planning concerns.
- If the information is too vague, lower the "score" and "tier", and say that
  we need more details in the "message".

Output format:
Return ONLY a valid JSON object with this exact structure and no extra text:

{
  "tier": "A" | "B" | "C",
  "score": 0-100,
  "segment": "short segment here",
  "message": "short explanation here"
}
`.trim();

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    let data: any = null;
    let lastError: Error | null = null;

    for (const model of GEMINI_MODELS) {
      try {
        const response = await fetch(`${GEMINI_ENDPOINT(model)}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          // 404 = model unavailable to this project; try next model
          // 429 = rate limit; try next model (may have separate quota)
          if (response.status === 404 || response.status === 429) {
            lastError = new Error(`Gemini ${model} returned ${response.status}`);
            continue;
          }
          throw new Error(`Gemini API returned ${response.status}: ${errText}`);
        }

        data = await response.json();
        break; // success
      } catch (modelErr) {
        lastError = modelErr as Error;
        continue;
      }
    }

    if (!data) {
      throw lastError || new Error("All Gemini models failed");
    }

    // Gemini 3.x thinking models return parts with thoughtSignature (no text).
    // Filter to parts that have a non-empty text field and concatenate.
    let content: string =
      data.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string }) => typeof p.text === "string" && p.text.length > 0)
        .map((p: { text?: string }) => p.text)
        .join("") ??
      data.text ??
      data.candidates?.[0]?.output ??
      "";

    // Strip markdown code fences if present (```json ... ```)
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Thinking models sometimes truncate the closing brace — try to repair
      const trimmed = content.trim();
      if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
        const repaired = trimmed + "}";
        try {
          const repairedParsed = JSON.parse(repaired);
          console.log("[rhs-intake] JSON repaired by appending '}'");
          return normalizeScoredLead(repairedParsed, lead);
        } catch {
          // fall through to throw
        }
      }
      throw new Error("No JSON found in Gemini response");
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return normalizeScoredLead(parsed, lead);
  } catch (err) {
    console.error("Gemini scoring failed, using fallback:", err);

    // --- Fallback heuristic (no AI available) ---
    const isOwner = lead.role?.toLowerCase().includes("owner");
    const isUrgent = /urgent|asap|emergency|flooding|damage/i.test(lead.notes || "");
    const hasAddress = Boolean(lead.property_address);

    let score = 40;
    if (isOwner) score += 20;
    if (isUrgent) score += 25;
    if (hasAddress) score += 10;
    score = Math.min(score, 100);

    const tier = score >= 80 ? "A" : score >= 60 ? "B" : "C";
    const segment = suggestSegment(lead) || `${lead.role} – ${isUrgent ? "High Urgency" : "Standard"} / ${hasAddress ? "On-Site" : "Remote"}`;
    const playbook = tierPlaybook(tier, segment);

    return {
      tier,
      score,
      segment,
      pipeline_stage: playbook.pipeline_stage,
      next_action: playbook.next_action,
      internal_notes: `Gemini AI unavailable; fallback heuristic used. ${playbook.internal_notes_template.replace("{score}", String(score))}`,
      message:
        tier === "A"
          ? "We'll review your property and reach out within 24 hours with next steps."
          : tier === "B"
            ? "We'll review your details and follow up within 1-2 days with recommendations."
            : "Thanks for reaching out — please share a bit more about your property so we can better understand your situation.",
    };
  }
}

async function insertLeadToSupabase(lead: LeadInput, scored: ScoredLead): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rhs_leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: lead.name,
      email: lead.email,
      role: lead.role,
      property_address: lead.property_address || null,
      notes: lead.notes || null,
      score: scored.score,
      tier: scored.tier,
      segment: scored.segment,
      pipeline_stage: scored.pipeline_stage,
      next_action: scored.next_action,
      internal_notes: scored.internal_notes,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Supabase insert failed: ${response.status} — ${err}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: LeadInput = await req.json();

    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { status: "error", message: "Missing required fields: name, email, role" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const scored = await scoreLeadWithGemini(body);
    await insertLeadToSupabase(body, scored);

    return NextResponse.json(
      {
        status: "ok",
        tier: scored.tier,
        score: scored.score,
        segment: scored.segment,
        pipeline_stage: scored.pipeline_stage,
        message: scored.message,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("rhs-intake error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error processing lead" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

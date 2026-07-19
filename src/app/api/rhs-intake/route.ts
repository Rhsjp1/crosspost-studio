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
              responseMimeType: "application/json",
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
        console.log(`[rhs-intake] Gemini ${model} responded:`, JSON.stringify(data).slice(0, 500));
        break; // success
      } catch (modelErr) {
        console.log(`[rhs-intake] Gemini ${model} failed:`, (modelErr as Error).message);
        lastError = modelErr as Error;
        continue;
      }
    }

    if (!data) {
      throw lastError || new Error("All Gemini models failed");
    }

    // Gemini 3.x thinking models return multiple parts — some are "thought"
    // parts with thoughtSignature (no text), some are the actual output.
    // Filter to parts that have a non-empty text field and concatenate.
    let content: string =
      data.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string }) => typeof p.text === "string" && p.text.length > 0)
        .map((p: { text?: string }) => p.text)
        .join("") ??
      data.text ??
      data.candidates?.[0]?.output ??
      "";

    console.log(`[rhs-intake] Raw content to parse (len=${content.length}):`, content.slice(0, 400));

    // Strip markdown code fences if present (```json ... ```)
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clamp values
    const tier = ["A", "B", "C"].includes(parsed.tier) ? parsed.tier : "C";
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
    const segment = parsed.segment || `${lead.role} – Lead`;
    const message = parsed.message || "Thank you for reaching out! We'll be in touch within 48 hours.";

    // Derive pipeline fields from tier (Gemini prompt doesn't return these)
    const pipeline_stage = "new";
    const next_action =
      tier === "A"
        ? "Priority: Schedule consultation call within 24 hours"
        : tier === "B"
          ? "Send follow-up email with service info, schedule call within 48 hours"
          : "Add to nurture sequence, request more details";
    const internal_notes = `Gemini score ${score}/100 (tier ${tier}). Segment: ${segment}`;

    return { tier, score, segment, pipeline_stage, next_action, internal_notes, message };
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

    return {
      tier,
      score,
      segment: `${lead.role} – ${isUrgent ? "High Urgency" : "Standard"} / ${hasAddress ? "On-Site" : "Remote"}`,
      pipeline_stage: "new",
      next_action: "Schedule initial consultation call",
      internal_notes: "Gemini AI unavailable; fallback heuristic used",
      message:
        tier === "A"
          ? "Your request has been prioritized — our team will reach out within 24 hours."
          : "Thank you for reaching out! We'll be in touch within 48 hours.",
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

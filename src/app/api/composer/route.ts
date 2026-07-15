import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Simple AI composer route — generates content stub for now
// In production, this would call OpenRouter/OpenAI for real generation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, tone = "professional", contentType = "social_post" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Get API keys from settings
    const apiKeyRow = await db.appSetting.findUnique({ where: { key: "COMPOSIO_API_KEY" } });
    const composioKey = apiKeyRow?.value || process.env.COMPOSIO_API_KEY;

    // Try to use OpenRouter for content generation if available
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    let generatedContent = "";

    if (openRouterKey) {
      try {
        const systemPrompt = `You are a content generation assistant for a property services company called Right Hand Services by JP. Generate ${contentType} content in a ${tone} tone. Keep it concise and engaging.`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "liquid/lfm-2.5-1.2b-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedContent = data.choices?.[0]?.message?.content || "";
        }
      } catch {
        // Fall through to template-based generation
      }
    }

    // Fallback: template-based generation
    if (!generatedContent) {
      generatedContent = generateTemplate(prompt, tone, contentType);
    }

    // Save generated content to DB
    const content = await db.content.create({
      data: {
        title: extractTitle(prompt),
        body: generatedContent,
        topic: prompt.substring(0, 100),
        tone,
        contentType,
        status: "draft",
        authorId: "system", // Will be updated to real user ID in production
      },
    });

    // Log history
    await db.historyEvent.create({
      data: {
        action: "content_generated",
        details: JSON.stringify({ contentType, tone, contentId: content.id }),
      },
    });

    return NextResponse.json({
      id: content.id,
      title: content.title,
      body: content.body,
      contentType: content.contentType,
      tone: content.tone,
      status: content.status,
    });
  } catch (error) {
    console.error("[composer POST]", error);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}

function extractTitle(prompt: string): string {
  const words = prompt.split(/\s+/).slice(0, 6);
  return words.join(" ") + (prompt.length > 40 ? "..." : "");
}

function generateTemplate(prompt: string, tone: string, contentType: string): string {
  const toneMap: Record<string, string> = {
    professional: "ready to serve your property needs",
    friendly: "here to help with a smile",
    casual: "keeping it real and getting things done",
    authoritative: "the trusted experts in property maintenance",
    humorous: "making property maintenance fun",
    inspirational: "transforming properties, changing lives",
  };

  const toneDesc = toneMap[tone] || toneMap.professional;
  const businessName = "Right Hand Services by JP";

  switch (contentType) {
    case "social_post":
      return `# ${prompt}\n\n${businessName} is ${toneDesc}! Whether it's irrigation design, landscape maintenance, or handyman services — we've got you covered.\n\nContact us today for a free consultation! 🏠✨\n\n#PropertyMaintenance #Handyman #RHS #HomeServices`;
    case "blog_post":
      return `# ${prompt}\n\n## Why ${businessName}?\n\nWhen it comes to property services in Troy, NC and surrounding areas, ${businessName} stands out. We are ${toneDesc}.\n\n### Our Services\n- Irrigation & Landscape Design\n- Property Maintenance Monitoring\n- Handyman Services\n- AI-Powered Property Reports\n\nContact us to learn how we can transform your property. 🏡`;
    case "email":
      return `Subject: ${prompt}\n\nHi there,\n\n${businessName} is ${toneDesc}.\n\nWe wanted to reach out regarding ${prompt.toLowerCase()}.\n\nOur team specializes in irrigation design, landscape maintenance, and comprehensive property services.\n\nWould you like to schedule a free consultation? Reply to this email or call us today.\n\nBest regards,\nJP\n${businessName}`;
    case "ad_copy":
      return `Headline: ${prompt}\n\nBody: ${businessName} — ${toneDesc}. Expert irrigation, landscaping, and handyman services in Troy, NC.\n\nCall Now for a Free Quote!\n\nCTA: Get Started Today`;
    case "video_script":
      return `[Scene: Property exterior]\n\nNarrator: Looking for reliable property services in Troy, NC?\n\n[Scene: Team at work]\n\nNarrator: ${businessName} is ${toneDesc}. From irrigation design to full landscape maintenance.\n\n[Scene: Before/After]\n\nNarrator: ${prompt}\n\n[Scene: Contact info]\n\nNarrator: Contact us today for your free consultation!`;
    default:
      return `${prompt}\n\nGenerated by ${businessName} — ${toneDesc}.`;
  }
}

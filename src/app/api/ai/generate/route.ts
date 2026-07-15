import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { aiGenerateSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = aiGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { prompt, tone, length, contentType } = parsed.data;

    // Build system prompt based on options
    const lengthGuide =
      length === "short"
        ? "Keep the response concise, around 100-200 words."
        : length === "medium"
        ? "Aim for a moderate length, around 300-500 words."
        : "Write a comprehensive, long-form piece of 500-1000 words.";

    const systemPrompt = `You are a professional content writer. Write ${contentType.replace("_", " ")} content with a ${tone} tone. ${lengthGuide} Only return the content text, no explanations or metadata.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: prompt },
    ];

    // Try OpenRouter first
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const googleKey = process.env.GOOGLE_AI_API_KEY;

    let generatedText = "";

    if (openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages,
            max_tokens: 2000,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        generatedText = data.choices?.[0]?.message?.content || "";
      } catch (err) {
        console.error("OpenRouter error:", err);
        // Fall through to Google AI
        generatedText = "";
      }
    }

    if (!generatedText && googleKey) {
      try {
        const model = "gemini-2.0-flash";
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: messages.map((m) => ({
                role: m.role === "system" ? "user" : "user",
                parts: [{ text: m.content }],
              })),
              generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.7,
              },
            }),
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Google AI API error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        generatedText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch (err) {
        console.error("Google AI error:", err);
      }
    }

    if (!generatedText) {
      return NextResponse.json(
        {
          error: "AI generation failed. Please configure OPENROUTER_API_KEY or GOOGLE_AI_API_KEY in your settings.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ text: generatedText });
  } catch (error) {
    console.error("POST /api/ai/generate error:", error);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}

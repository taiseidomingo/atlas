import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required " },
      { status: 400 },
    );
  }

  const prompt = buildPrompt(message);

  const response = await fetch(
    `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: "Gemini failed", details: errorText },
      { status: 502 },
    );
  }

  const data = await response.json();
  const reply =
    data.candidates?.[0]?.content?.part?.[0]?.text ?? "no response generated.";

  return NextResponse.json({ reply });
}

function buildPrompt(userMessage: string): string {
  return `You are Atlas, a helpful campus navigation assistant. Answer briefly and clearly.
 
    User: ${userMessage}
    Atlas: `;
}

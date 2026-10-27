import { NextRequest, NextResponse } from "next/server";
import { listReservations, Reservation } from "../lib/reservation";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const { message } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const reservations = listReservations();
  const prompt = buildPrompt(message, reservations);

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return NextResponse.json(
      { error: "Unable to reach Gemini", details: message },
      { status: 504 },
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: `Gemini request failed (${response.status})`,
        details: errorText,
      },
      { status: 502 },
    );
  }

  const data = await response.json();
  const reply =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.";

  return NextResponse.json({ reply });
}

function buildPrompt(userMessage: string, reservations: Reservation[]): string {
  const roomList =
    reservations.length > 0
      ? reservations
          .map((r) => `- ${r.professor} is in ${r.roomName}`)
          .join("\n")
      : "(no rooms are currently claimed)";

  return `You are Atlas, a helpful campus navigation assistant. Answer briefly and clearly.

Here is the current list of rooms claimed by professors:
${roomList}

Rules:
- When asked where a professor is, answer using ONLY the list above.
- Match names loosely (for example "Smith" can match "Dr. Smith").
- If the professor is not in the list, say you don't have a room for them right now. Do not guess.

User: ${userMessage}
Atlas:`;
}

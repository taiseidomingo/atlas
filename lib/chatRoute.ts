import { NextRequest, NextResponse } from "next/server";
import { listReservations, Reservation } from "../lib/reservation";
import { getBuildingName, getFloorName, getRoomName } from "./roomAdmin";
import { relevantKnowledge, type KnowledgeHit } from "./knowledgeBase";
import { answerProfessorQuestion } from "./professorLocator";
import { withSharedState } from "./persist";
import { buildPlaceIndex } from "./placeSearch";
import { handleChat, sanitizeContext } from "./chatEngine";
import type { NameLookup } from "./routeGuide";
import type { ChatEvent, ChatRequest, ChatResponse } from "./chatTypes";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const UNAVAILABLE =
  "I don't have that information in the campus knowledge base yet. Please check with the relevant campus office.";

/** Current display names (admin-managed) for places, buildings and floors. */
const serverNames: NameLookup = {
  place: (id, fallback) => getRoomName(id, fallback),
  building: (id, fallback) => getBuildingName(id, fallback),
  floor: (id, floor, fallback) => getFloorName(id, floor, fallback),
};

function parseEvent(raw: unknown): ChatEvent | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  if (e.type === "start-selected" && typeof e.startId === "string") {
    return { type: "start-selected", startId: e.startId };
  }
  if ((e.type === "choose" || e.type === "directions") && typeof e.placeId === "string") {
    return { type: e.type, placeId: e.placeId };
  }
  return undefined;
}

async function handlePOST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const message: unknown = body.message;
  const event = parseEvent(body.event);

  if (!event && (!message || typeof message !== "string" || message.length > 1000)) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const context = sanitizeContext(body.context);
  // Older clients sent the destination they were waiting to route to.
  if (typeof body.destinationId === "string" && !context.destinationId) {
    context.destinationId = sanitizeContext({ destinationId: body.destinationId }).destinationId;
    if (context.destinationId) context.awaiting = "start";
  }

  const chatRequest: ChatRequest = {
    message: typeof message === "string" ? message : undefined,
    event,
    context,
  };

  // 1. Finding and reaching places, professors included: answered from the
  //    map and faculty records only, never by the language model.
  const navigation = handleChat(chatRequest, {
    index: buildPlaceIndex(serverNames),
    names: serverNames,
    professor: answerProfessorQuestion,
  });
  if (navigation) return NextResponse.json(navigation satisfies ChatResponse);
  if (typeof message !== "string") {
    return NextResponse.json({ reply: "Sorry, I couldn't do that.", context } satisfies ChatResponse);
  }

  // 2. Campus questions: grounded in the admin-uploaded knowledge base.
  const hits = relevantKnowledge(message);
  const sources = [...new Set(hits.map((h) => h.title))];
  const kbContext = { ...context, awaiting: null, options: [], optionPurpose: null };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: offlineReply(hits), context: kbContext, sources } satisfies ChatResponse);
  }

  const prompt = buildPrompt(message, listReservations(), hits);

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
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // Network trouble: still answer from the knowledge base.
    return NextResponse.json({ reply: offlineReply(hits), context: kbContext, sources } satisfies ChatResponse);
  }

  if (!response.ok) {
    return NextResponse.json({ reply: offlineReply(hits), context: kbContext, sources } satisfies ChatResponse);
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || offlineReply(hits);

  return NextResponse.json({ reply, context: kbContext, sources } satisfies ChatResponse);
}

/** Answer without the language model: quote the best knowledge-base passage. */
function offlineReply(hits: KnowledgeHit[]): string {
  if (hits.length === 0) {
    return `${UNAVAILABLE}\n\nFor places, try asking "Where is Room 204?" or "How do I get to the Library?".`;
  }
  const best = hits[0];
  const text = best.text.length > 600 ? `${best.text.slice(0, 600).trimEnd()}…` : best.text;
  return `From "${best.title}":\n${text}`;
}

function buildPrompt(userMessage: string, reservations: Reservation[], hits: KnowledgeHit[]): string {
  const roomList =
    reservations.length > 0
      ? reservations
          .map((r) => `- ${r.professor} has an active claim on ${getRoomName(r.nodeId, r.roomName)}`)
          .join("\n")
      : "(no rooms are currently claimed)";
  const knowledge =
    hits.length > 0
      ? hits.map((h, i) => `[${i + 1}] Source: "${h.title}"\n${h.text}`).join("\n\n")
      : "(no matching passages)";

  return `You are Atlas, the campus assistant for CvSU Imus. Answer briefly and clearly.

KNOWLEDGE BASE EXCERPTS (uploaded by campus administrators):
${knowledge}

ACTIVE ROOM CLAIMS BY PROFESSORS:
${roomList}

Rules:
- Answer campus questions (offices, procedures, policies, schedules, services, contacts) ONLY with facts from the knowledge base excerpts. Do not use outside knowledge about the school.
- If the excerpts do not contain the answer, reply exactly: "${UNAVAILABLE}"
- Never invent names, dates, fees, rooms, phone numbers or rules.
- When you use an excerpt, mention its source title, e.g. (Source: Enrollment FAQ).
- For a professor's whereabouts, use only the active room claims above and never say a professor is present anywhere else.
- Never give directions or say where a room is; the map assistant handles that. If asked, suggest asking "Where is <place>?".
- Greetings and small talk can be answered normally in one sentence.

User: ${userMessage}
Atlas:`;
}

export const POST = withSharedState(handlePOST);

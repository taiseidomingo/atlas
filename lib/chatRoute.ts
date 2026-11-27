import { NextRequest, NextResponse } from "next/server";
import { listReservations, Reservation } from "../lib/reservation";
import { campusGraph } from "./graph";
import { getRoomName } from "./roomAdmin";
import { relevantKnowledge, type KnowledgeHit } from "./knowledgeBase";
import { answerProfessorQuestion } from "./professorLocator";
import { withSharedState } from "./persist";

export interface ChatNavigationRequest {
  startId?: string;
  destinationId: string;
}

const navigableNodes = campusGraph.nodes.filter(
  (node) => node.kind === "entrance" || node.kind === "gate",
);

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function navigationRequest(
  message: string,
  forcedDestinationId?: string,
): ChatNavigationRequest | null {
  const text = compact(message);
  const matches = navigableNodes
    .flatMap((node) =>
      [getRoomName(node.id, node.name), getRoomName(node.id, node.name).replace(/\s*\([^)]*\)$/, "")].map((alias) => ({
        id: node.id,
        alias: compact(alias),
      })),
    )
    .filter((candidate) => candidate.alias.length > 2)
    .sort((a, b) => b.alias.length - a.alias.length)
    .map((candidate) => ({
      ...candidate,
      index: text.indexOf(candidate.alias),
    }))
    .filter((candidate) => candidate.index >= 0)
    .filter((candidate, index, all) => all.findIndex((other) => other.id === candidate.id) === index)
    .sort((a, b) => a.index - b.index);

  if (forcedDestinationId && matches.length > 0) {
    return {
      startId: matches[matches.length - 1].id,
      destinationId: forcedDestinationId,
    };
  }
  if (matches.length === 0) return null;
  const asksForDirections =
    /\b(how|get|go|take|navigate|direction|route|where)\b/i.test(message);
  if (!asksForDirections && matches.length < 2) return null;

  if (matches.length >= 2 && /\bfrom\b/i.test(message)) {
    return {
      startId: matches[0].id,
      destinationId: matches[matches.length - 1].id,
    };
  }

  return { destinationId: matches[matches.length - 1].id };
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const UNAVAILABLE =
  "I don't have that information in the campus knowledge base yet. Please check with the relevant campus office.";

async function handlePOST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { message, destinationId } = body;

  if (!message || typeof message !== "string" || message.length > 1000) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const forcedDestination =
    typeof destinationId === "string" &&
    navigableNodes.some((node) => node.id === destinationId)
      ? destinationId
      : undefined;

  // 1. Professor whereabouts: answered from records only (claims, schedules,
  //    department areas), never by the language model.
  if (!forcedDestination) {
    const professor = answerProfessorQuestion(message);
    if (professor) {
      return NextResponse.json({
        reply: professor.reply,
        actions: professor.actions,
        source: professor.source,
        navigation: null,
      });
    }
  }

  const navigation = navigationRequest(message, forcedDestination);
  // 2. Campus questions: grounded in the admin-uploaded knowledge base.
  const hits = relevantKnowledge(message);
  const sources = [...new Set(hits.map((h) => h.title))];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply: offlineReply(hits, navigation),
      navigation,
      sources,
    });
  }

  const prompt = buildPrompt(message, listReservations(), hits, !!navigation);

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
    return NextResponse.json({ reply: offlineReply(hits, navigation), navigation, sources });
  }

  if (!response.ok) {
    return NextResponse.json({ reply: offlineReply(hits, navigation), navigation, sources });
  }

  const data = await response.json();
  const reply =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || offlineReply(hits, navigation);

  return NextResponse.json({ reply, navigation, sources });
}

/** Answer without the language model: quote the best knowledge-base passage. */
function offlineReply(hits: KnowledgeHit[], navigation: ChatNavigationRequest | null): string {
  if (navigation) {
    const node = navigableNodes.find((n) => n.id === navigation.destinationId);
    return `Opening directions to ${node ? getRoomName(node.id, node.name) : "that place"} on the campus map.`;
  }
  if (hits.length === 0) return UNAVAILABLE;
  const best = hits[0];
  const text = best.text.length > 600 ? `${best.text.slice(0, 600).trimEnd()}…` : best.text;
  return `From "${best.title}":\n${text}`;
}

function buildPrompt(
  userMessage: string,
  reservations: Reservation[],
  hits: KnowledgeHit[],
  isDirections: boolean,
): string {
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
- For a professor's whereabouts, use only the active room claims above and never say a professor is present anywhere else.${
    isDirections
      ? "\n- The user asked for directions: the campus map is opening the route for them, so just confirm briefly."
      : ""
  }
- Greetings and small talk can be answered normally in one sentence.

User: ${userMessage}
Atlas:`;
}

export const POST = withSharedState(handlePOST);

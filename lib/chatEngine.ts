import { routingNodeById } from "./routingGraph";
import { buildRouteGuide, nodeLabel, type NameLookup } from "./routeGuide";
import {
  resolvePlace,
  scorePlaces,
  tokenize,
  type Place,
} from "./placeSearch";
import type { ProfessorAnswer } from "./professorLocator";
import {
  EMPTY_CONTEXT,
  type ChatContext,
  type ChatOption,
  type ChatRequest,
  type ChatResponse,
} from "./chatTypes";

/**
 * Conversational campus navigation. Understands location questions,
 * follow-ups ("yes", "take me there", "go back") and starting-point answers,
 * and answers only from the map and faculty records: every place it names
 * or pins exists in the routing graph.
 *
 * Returns null when the message isn't about finding or reaching a place, so
 * the caller can answer it from the knowledge base instead.
 */

export interface EngineDeps {
  index: Place[];
  names: NameLookup;
  professor: (message: string) => ProfessorAnswer | null;
}

const RE = {
  clear:
    /^\s*(please\s+)?(clear|reset|remove|cancel|stop)\b|\b(clear|reset|remove|cancel|delete)\b.*\b(route|path|directions?|navigation|map|pins?|markers?)\b|\bstart over\b/i,
  whereAmI: /^\s*(where am i|nasaan ako|asan ako)\b|\bwhere am i (currently|right now|now)\b/i,
  changeStart:
    /\b(change|set|update|pick|choose|select|mark)\s+(my\s+)?(start|starting|current)\s*(point|location|place)?\b|\bi('?m| am) somewhere else\b/i,
  goBack:
    /\b(go|take me|bring me)\s+back\b|\bprevious\s+(place|location|one|room|spot)\b|\blast\s+(place|location)\b|^\s*back\s*$/i,
  another:
    /\b(find|search|look for|show)\s+(another|a different|other|a new)\b|\banother\s+(room|place|location|office|one)\b|\bnew search\b|\bsomething else\b/i,
  affirm:
    /^\s*(yes|yeah|yep|yup|ya|sure|ok|okay|okey|k|please|go ahead|sige|oo|opo|alright|of course|definitely|let'?s go|absolutely|why not)\b/i,
  negate: /^\s*(no|nope|nah|not now|no thanks|hindi|huwag|wag|never ?mind|cancel)\b/i,
  directions:
    /\b(how\s+(do|can|would|should)\s+(i|we)\s+(get|go|reach|find)|how\s+to\s+(get|go|reach)|take\s+me|bring\s+me|walk\s+me|lead\s+me|guide\s+me|directions?|route|navigate|way\s+to|go\s+to|get\s+to|get\s+there|go\s+there|paano|papunta|ihatid)\b/i,
  where:
    /\b(where|find|locate|show|look(ing)?\s+for|saan|nasaan|asan|which\s+(building|floor))\b/i,
  showIt: /\b(show|pin|highlight|display|point|zoom)\b|\bon the map\b/i,
  startAnswer:
    /^\s*(i'?m|i am|am|we'?re|we are|currently|right now|nasa|andito|dito|at|from|near|inside)\b|\b(i'?m|i am|we'?re)\s+(at|in|near|inside|by|outside)\b/i,
  pickOnMap:
    /\b(pick|tap|select|choose|mark|pin|click)\b.*\bmap\b|\bon the map\b|\b(don'?t|do not) know\b|\bnot sure\b|\bno idea\b/i,
  iAmAt:
    /\b(i'?m|i am|we'?re|we are)\s+(currently\s+|now\s+|right\s+now\s+)?(at|in|near|inside|by|beside)\b|^\s*(nasa|andito\s+ako)\b/i,
  optionRef: /\b(one|former|latter)\b|^\s*(in|at|on|sa|yung)\b/i,
  greeting: /^\s*(hi|hello|hey|good\s+(morning|afternoon|evening|day)|kumusta|musta|yo)\b/i,
  help: /\b(help|what can you do|how does (this|it) work|what do you do)\b/i,
  thanks: /^\s*(thanks|thank you|salamat|ty)\b/i,
  ordinal:
    /^\s*(?:the\s+)?(?:(\d)|(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th))(?:\s+one)?\s*[.!]?\s*$/i,
};

const ORDINALS: Record<string, number> = {
  first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3,
  fourth: 4, "4th": 4, fifth: 5, "5th": 5, sixth: 6, "6th": 6,
};

const HELP_TEXT =
  "I can find rooms, offices, buildings and professors, pin them on the map, and walk you there. Try:\n" +
  "• Where is Room 204?\n• Where is the Registrar?\n• Where can I find Professor (name)?\n• How do I get to the Library?\n" +
  "When you ask for directions, I'll ask where you are — tap your spot on the map or tell me (e.g. \"Gate 1\").";

function isNode(id: unknown): id is string {
  return typeof id === "string" && routingNodeById.has(id);
}

/** Context from the client, with every place id checked against the map. */
export function sanitizeContext(raw: Partial<ChatContext> | undefined): ChatContext {
  const c = raw ?? {};
  return {
    startId: isNode(c.startId) ? c.startId : null,
    destinationId: isNode(c.destinationId) ? c.destinationId : null,
    lastPlaceId: isNode(c.lastPlaceId) ? c.lastPlaceId : null,
    previousPlaceId: isNode(c.previousPlaceId) ? c.previousPlaceId : null,
    awaiting: c.awaiting === "start" || c.awaiting === "directions-offer" ? c.awaiting : null,
    options: Array.isArray(c.options) ? c.options.filter(isNode).slice(0, 8) : [],
    optionPurpose:
      c.optionPurpose === "show" || c.optionPurpose === "directions" || c.optionPurpose === "start"
        ? c.optionPurpose
        : null,
  };
}

export function handleChat(req: ChatRequest, deps: EngineDeps): ChatResponse | null {
  const ctx = sanitizeContext(req.context);
  const { index, names } = deps;
  const byId = new Map(index.map((p) => [p.id, p]));

  const placeOf = (id: string): Place | null => byId.get(id) ?? null;
  const label = (id: string) => nodeLabel(names, id);
  const card = (p: Place) => ({ id: p.id, name: p.name, context: p.context, type: p.type });

  const fresh = (patch: Partial<ChatContext>): ChatContext => ({
    ...ctx,
    awaiting: null,
    options: [],
    optionPurpose: null,
    ...patch,
  });

  const remember = (id: string): Partial<ChatContext> =>
    ctx.lastPlaceId && ctx.lastPlaceId !== id
      ? { lastPlaceId: id, previousPlaceId: ctx.lastPlaceId }
      : { lastPlaceId: id };

  function whereText(p: Place): string {
    if (p.type === "Building entrance") return `Here's the **${p.context.split(",")[0]}**.`;
    if (!p.building) return `**${p.name}** is on the campus grounds.`;
    return `**${p.name}** is in the ${p.context}.`;
  }

  // ---- outcomes ---------------------------------------------------------

  function routeReply(startId: string, destId: string, intro?: string): ChatResponse {
    const guide = buildRouteGuide(startId, destId, names);
    const dest = placeOf(destId);
    if (!guide) {
      return {
        reply:
          startId === destId
            ? `You're already at **${label(destId)}**.`
            : `I couldn't find a walkable route between **${label(startId)}** and **${label(destId)}** in the campus map data. Please ask at the nearest office for help.`,
        context: fresh({ startId, destinationId: destId, ...remember(destId) }),
        command: { type: "show", placeId: destId },
        place: dest ? card(dest) : null,
      };
    }
    const startName = label(startId);
    const destName = label(destId);
    return {
      reply:
        (intro ? `${intro} ` : "") +
        `Here's the way from **${startName}** to **${destName}**: about ${Math.round(guide.distance)} m, ${guide.minutes} min on foot.`,
      context: fresh({ startId, destinationId: destId, ...remember(destId) }),
      command: { type: "route", startId, destinationId: destId },
      place: dest ? card(dest) : null,
      route: {
        startId,
        destinationId: destId,
        startName,
        destinationName: destName,
        distance: guide.distance,
        minutes: guide.minutes,
        steps: guide.steps,
      },
      quickReplies: ["Change starting point", "Clear the route"],
    };
  }

  function askForStart(dest: Place | null, lead?: string): ChatResponse {
    return {
      reply:
        (lead ??
          (dest
            ? `Let's get you to **${dest.name}**. Where are you now?`
            : "Where are you now?")) +
        "\nTap your spot on the map, or type a place like \"Gate 1\".",
      context: fresh({
        destinationId: dest ? dest.id : ctx.destinationId,
        awaiting: "start",
        ...(dest ? remember(dest.id) : {}),
      }),
      command: { type: "pick-start", destinationId: dest ? dest.id : ctx.destinationId },
      place: dest ? card(dest) : null,
    };
  }

  function directionsTo(dest: Place): ChatResponse {
    if (ctx.startId && ctx.startId !== dest.id) {
      return routeReply(
        ctx.startId,
        dest.id,
        "",
      );
    }
    return askForStart(dest);
  }

  function show(p: Place): ChatResponse {
    return {
      reply: `${whereText(p)} Want directions?`,
      context: fresh({ awaiting: "directions-offer", ...remember(p.id) }),
      command: { type: "show", placeId: p.id },
      place: card(p),
      quickReplies: ["Yes, take me there", "Find another room"],
    };
  }

  function setStart(start: Place | { id: string }): ChatResponse {
    const dest = ctx.destinationId;
    if (dest && dest !== start.id) return routeReply(start.id, dest, "Got it!");
    return {
      reply: `Got it — I've marked **${label(start.id)}** as your starting point. Where would you like to go?`,
      context: fresh({ startId: start.id }),
      command: { type: "set-start", placeId: start.id },
    };
  }

  function choices(options: Place[], purpose: "show" | "directions" | "start", lead: string): ChatResponse {
    return {
      reply: lead,
      context: { ...ctx, awaiting: purpose === "start" ? "start" : ctx.awaiting, options: options.map((p) => p.id), optionPurpose: purpose },
      options: options.map<ChatOption>((p) => ({
        label: p.name,
        sublabel: p.detail ? `${p.context} · ${p.detail}` : p.context,
        placeId: p.id,
      })),
    };
  }

  function choose(p: Place, purpose: ChatContext["optionPurpose"]): ChatResponse {
    if (purpose === "start") return setStart(p);
    if (purpose === "directions") return directionsTo(p);
    return show(p);
  }

  // ---- events from the UI -----------------------------------------------

  const event = req.event;
  if (event) {
    if (event.type === "start-selected" && isNode(event.startId)) {
      return setStart({ id: event.startId });
    }
    if ((event.type === "choose" || event.type === "directions") && isNode(event.placeId)) {
      const p = placeOf(event.placeId);
      if (!p) return null;
      if (event.type === "directions") return directionsTo(p);
      return choose(p, ctx.optionPurpose ?? "show");
    }
    return null;
  }

  const message = (req.message ?? "").trim();
  if (!message) return null;
  const hasPlaceWords = tokenize(message).some((t) => scoreWorthy(t));

  // Narrow a pending "which one?" list ("the one in the New Building").
  const narrowOptions = (): Place | null => {
    const optionPlaces = ctx.options.map(placeOf).filter((p): p is Place => !!p);
    const q = new Set(tokenize(message));
    const scored = optionPlaces
      .map((p) => ({
        p,
        hits: [...new Set([...p.contextTokens, ...p.aliases.flat(), ...tokenize(p.detail ?? "")])].filter((t) =>
          q.has(t),
        ).length,
      }))
      .sort((a, b) => b.hits - a.hits);
    return scored[0] && scored[0].hits > 0 && (scored.length === 1 || scored[0].hits > scored[1].hits)
      ? scored[0].p
      : null;
  };

  // "the second one" after a "which one did you mean?" question.
  if (ctx.options.length > 0) {
    const m = message.match(RE.ordinal);
    if (m) {
      const n = m[1] ? Number(m[1]) : ORDINALS[m[2].toLowerCase()];
      const p = placeOf(ctx.options[n - 1] ?? "");
      if (p) return choose(p, ctx.optionPurpose);
    }
    if (RE.optionRef.test(message)) {
      const p = narrowOptions();
      if (p) return choose(p, ctx.optionPurpose);
    }
  }

  if (RE.clear.test(message) && !RE.where.test(message)) {
    return {
      reply: "Route cleared. Where to next?",
      context: { ...EMPTY_CONTEXT, lastPlaceId: ctx.lastPlaceId, previousPlaceId: ctx.previousPlaceId },
      command: { type: "clear" },
    };
  }

  if (RE.whereAmI.test(message)) {
    if (ctx.startId) {
      const p = placeOf(ctx.startId);
      return {
        reply: `You're at **${label(ctx.startId)}**${p && p.building ? ` (${p.context})` : ""} — that's your current starting point. Not there anymore? Tap "Change starting point".`,
        context: fresh({}),
        command: { type: "show", placeId: ctx.startId },
        quickReplies: ["Change starting point"],
      };
    }
    return askForStart(null, "I don't know your location yet (live GPS isn't calibrated for this campus map).");
  }

  if (RE.changeStart.test(message) && !hasPlaceWords) {
    const dest = ctx.destinationId ? placeOf(ctx.destinationId) : null;
    return askForStart(dest, "Okay, let's update your starting point.");
  }

  if (RE.goBack.test(message)) {
    const prev = ctx.previousPlaceId ? placeOf(ctx.previousPlaceId) : null;
    if (!prev) {
      return { reply: "There's no previous location to go back to yet.", context: fresh({}) };
    }
    return show(prev);
  }

  if (ctx.awaiting === "directions-offer" && ctx.lastPlaceId && !hasPlaceWords) {
    if (RE.affirm.test(message) || RE.directions.test(message)) {
      const p = placeOf(ctx.lastPlaceId);
      if (p) return directionsTo(p);
    }
    if (RE.negate.test(message)) {
      return {
        reply: "No problem! It stays pinned on the map. Ask me about another room, office or professor anytime.",
        context: fresh({}),
      };
    }
  }

  if (ctx.awaiting === "start" && RE.negate.test(message) && !hasPlaceWords) {
    return {
      reply: "Okay, I've stopped asking for your location. Ask me for directions whenever you're ready.",
      context: fresh({}),
      command: null,
    };
  }

  // "from X to Y" in one message.
  const fromTo =
    message.match(/\bfrom\s+(.+?)\s+(?:to|going to|papunta sa|towards)\s+(.+?)[?.!]*$/i) ??
    swap(message.match(/\b(?:to|get to|go to|reach)\s+(.+?)\s+from\s+(.+?)[?.!]*$/i));
  if (fromTo) {
    const a = resolvePlace(fromTo[1], index);
    const b = resolvePlace(fromTo[2], index);
    if (a.kind === "found" && b.kind === "found") {
      return routeReply(a.place.id, b.place.id, "On it!");
    }
    if (b.kind === "found" && a.kind === "ambiguous") {
      ctx.destinationId = b.place.id;
      return choices(a.options, "start", "Which of these is your starting point?");
    }
    if (a.kind === "found" && b.kind === "ambiguous") {
      ctx.startId = a.place.id;
      return choices(b.options, "directions", "Which one are you heading to?");
    }
  }

  // Professors: answered from claims, schedules and department areas only.
  const prof = deps.professor(message);
  if (prof) {
    if (prof.candidates && prof.candidates.length > 1) {
      return {
        reply: prof.reply,
        context: fresh({}),
        options: prof.candidates.map((name) => ({ label: name, message: `Where is ${name}?` })),
      };
    }
    const p = prof.placeId ? placeOf(prof.placeId) : null;
    if (p && RE.directions.test(message)) {
      const r = directionsTo(p);
      return { ...r, reply: `${prof.reply}\n\n${r.reply}` };
    }
    if (p) {
      return {
        reply: `${prof.reply}\n\n**${p.name}** is marked on the map. Want directions?`,
        context: fresh({ awaiting: "directions-offer", ...remember(p.id) }),
        command: { type: "show", placeId: p.id },
        place: card(p),
        quickReplies: ["Yes, take me there", "Find another professor"],
      };
    }
    return { reply: prof.reply, context: fresh({}) };
  }

  const wantsDirections = RE.directions.test(message);
  const wantsPlace = wantsDirections || RE.where.test(message);

  // Referring back: "take me there", "show it on the map".
  if (!hasPlaceWords) {
    const last = ctx.lastPlaceId ? placeOf(ctx.lastPlaceId) : null;
    if (ctx.awaiting === "start" && RE.pickOnMap.test(message)) {
      return askForStart(ctx.destinationId ? placeOf(ctx.destinationId) : null, "Sure — use the map.");
    }
    if (last && wantsDirections) return directionsTo(last);
    if (last && RE.showIt.test(message)) return show(last);
    if (RE.another.test(message)) {
      return {
        reply: "Sure! Which room, office, building or professor are you looking for?",
        context: fresh({ destinationId: null }),
        quickReplies: ["Where is the Library?", "Where is the Registrar?", "Where is Room 204?"],
      };
    }
    if (RE.thanks.test(message)) {
      return { reply: "You're welcome! Safe walking. 👋", context: fresh({}) };
    }
    if (RE.greeting.test(message) || RE.help.test(message)) {
      return { reply: `Hi! ${HELP_TEXT}`, context: fresh({}) };
    }
    if (ctx.awaiting === "start") {
      return askForStart(ctx.destinationId ? placeOf(ctx.destinationId) : null, "I still need your starting point.");
    }
    if (RE.affirm.test(message) && !last) {
      return { reply: HELP_TEXT, context: fresh({}) };
    }
    return null;
  }

  const resolution = resolvePlace(message, index);

  if (ctx.options.length > 0 && resolution.kind !== "found") {
    const p = narrowOptions();
    if (p) return choose(p, ctx.optionPurpose);
  }

  // "I'm at the canteen" sets the starting point even when not asked.
  if (RE.iAmAt.test(message) && !wantsDirections && resolution.kind === "found") {
    return setStart(resolution.place);
  }

  // An answer to "where are you?".
  if (ctx.awaiting === "start" && (RE.startAnswer.test(message) || !wantsPlace)) {
    if (resolution.kind === "found") return setStart(resolution.place);
    if (resolution.kind === "ambiguous") {
      return choices(resolution.options, "start", "I found a few places with that name. Which one are you at?");
    }
    const dest = ctx.destinationId ? placeOf(ctx.destinationId) : null;
    return askForStart(
      dest,
      `I couldn't find "${describe(message)}" on the campus map, so I can't use it as a starting point.`,
    );
  }

  if (resolution.kind === "found") {
    return wantsDirections ? directionsTo(resolution.place) : show(resolution.place);
  }
  if (resolution.kind === "ambiguous") {
    return choices(
      resolution.options,
      wantsDirections ? "directions" : "show",
      `I found ${resolution.options.length} places that match. Which one do you mean?`,
    );
  }

  if (wantsPlace || RE.another.test(message)) {
    const suggestions = resolution.suggestions;
    return {
      reply:
        `I couldn't find "${describe(message)}" in the campus map records, so I can't show it on the map.` +
        (suggestions.length
          ? " Did you mean one of these?"
          : " Try a room number (e.g. Room 204), an office (e.g. Registrar) or a building name."),
      context: suggestions.length
        ? { ...ctx, awaiting: null, options: suggestions.map((p) => p.id), optionPurpose: wantsDirections ? "directions" : "show" }
        : fresh({}),
      options: suggestions.map((p) => ({ label: p.name, sublabel: p.context, placeId: p.id })),
    };
  }

  return null;
}

function swap(m: RegExpMatchArray | null): RegExpMatchArray | null {
  if (!m) return null;
  const out = [m[0], m[2], m[1]] as unknown as RegExpMatchArray;
  return out;
}

// Words that can name a place (not filler like "where", "take", "there").
const FILLER = new Set(
  (
    "a an the to of in at on is are was be am i me my we you your it its this that there here where wheres how what which who " +
    "do does did can could would will should please pls find locate located location show see view get go going take bring lead " +
    "guide navigate navigation direction directions route way path map pin point highlight give tell know need want looking look " +
    "for with near nearest closest from currently now right just im m re ll ve d s t am also and or but then so ok okay hi hello " +
    "hey thanks thank yes yeah yep sure no nope not saan nasaan asan ang ng sa po paano pumunta papunta yung dito back previous " +
    "last another different other new something else again clear reset remove cancel stop start starting over change set " +
    "update pick choose select mark tap click somewhere one first second third current spot place walk me us there"
  ).split(/\s+/),
);

// Generic nouns: "find another room" names no particular place.
const GENERIC_NOUNS = new Set(
  "room rooms office place location building professor prof teacher instructor faculty lab area destination".split(" "),
);

function scoreWorthy(token: string): boolean {
  return !FILLER.has(token) && !GENERIC_NOUNS.has(token);
}

/** The place part of a question, for "I couldn't find …" replies. */
function describe(message: string): string {
  const words = message
    .replace(/[?!.]+$/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        !FILLER.has(
          w
            .toLowerCase()
            .replace(/['’]s$/, "")
            .replace(/[^a-z0-9]/g, ""),
        ),
    );
  const text = words.join(" ").trim();
  return text.length > 0 ? text.slice(0, 60) : message.slice(0, 60);
}

export { scorePlaces };

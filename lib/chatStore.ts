"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_CONTEXT,
  type ChatContext,
  type ChatEvent,
  type ChatOption,
  type ChatPlace,
  type ChatResponse,
  type ChatRoute,
  type MapCommand,
} from "./chatTypes";
import { getNav, nav, onStartConfirmed } from "./navStore";

/**
 * Conversation state for the ATLAS assistant, shared by the floating chat
 * and the panel on the map page so the conversation carries across pages.
 * Map commands returned by the server are applied to the navigation store.
 */

export interface ChatMessage {
  id: number;
  from: "me" | "bot";
  text: string;
  place?: ChatPlace | null;
  options?: ChatOption[];
  route?: ChatRoute | null;
  quickReplies?: string[];
  sources?: string[];
  error?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  context: ChatContext;
  busy: boolean;
  /** Bumped when a reply moved the map, so the app can bring the map into view. */
  mapRequest: number;
}

const WELCOME: ChatMessage = {
  id: 0,
  from: "bot",
  text:
    "Hi! Ask me where a room, office or professor is, and I'll show you the way.",
  quickReplies: ["Where is the Library?", "Where is Room 204?"],
};

const STORAGE_KEY = "atlas.chat.v1";
let nextId = 1;

function restore(): ChatState {
  const empty: ChatState = { messages: [WELCOME], context: EMPTY_CONTEXT, busy: false, mapRequest: 0 };
  if (typeof window === "undefined") return empty;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Array.isArray(saved.messages) && saved.messages.length > 0) {
      nextId = Math.max(...saved.messages.map((m: ChatMessage) => m.id)) + 1;
      return { ...empty, messages: saved.messages.slice(-60), context: { ...EMPTY_CONTEXT, ...saved.context } };
    }
  } catch {
    // storage unavailable: start fresh
  }
  return empty;
}

let state: ChatState | null = null;
const listeners = new Set<() => void>();

function get(): ChatState {
  if (!state) state = restore();
  return state;
}

function set(patch: Partial<ChatState>) {
  state = { ...get(), ...patch };
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: state.messages.slice(-60), context: state.context }),
    );
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: ChatState = { messages: [WELCOME], context: EMPTY_CONTEXT, busy: false, mapRequest: 0 };

export function useChat(): ChatState {
  return useSyncExternalStore(subscribe, get, () => serverSnapshot);
}

function push(message: Omit<ChatMessage, "id">) {
  set({ messages: [...get().messages, { ...message, id: nextId++ }] });
}

function applyCommand(command: MapCommand | null | undefined) {
  if (!command) return false;
  switch (command.type) {
    case "show":
      nav.showPlace(command.placeId);
      break;
    case "set-start":
      nav.setStart(command.placeId);
      break;
    case "route":
      nav.showRoute(command.startId, command.destinationId);
      break;
    case "pick-start":
      nav.beginPick(command.destinationId);
      break;
    case "clear":
      nav.clear();
      break;
  }
  return true;
}

/** The map is the source of truth for the start and destination. */
function currentContext(): ChatContext {
  const { context } = get();
  const n = getNav();
  // While answering "which one did you mean?", keep what the question said
  // ("from the canteen to the CR") instead of the map's older start/destination.
  if (context.options.length > 0) {
    return {
      ...context,
      startId: context.startId ?? n.start,
      destinationId: context.destinationId ?? n.dest,
    };
  }
  return {
    ...context,
    startId: n.start,
    destinationId: n.dest ?? context.destinationId,
  };
}

async function request(body: { message?: string; event?: ChatEvent }) {
  set({ busy: true });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, context: currentContext() }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<ChatResponse> & { error?: string };
    if (!res.ok || typeof data.reply !== "string") {
      push({ from: "bot", text: data.error ?? "Sorry, something went wrong. Please try again.", error: true });
      return;
    }
    push({
      from: "bot",
      text: data.reply,
      place: data.place ?? null,
      options: data.options?.length ? data.options : undefined,
      route: data.route ?? null,
      quickReplies: data.quickReplies?.length ? data.quickReplies : undefined,
      sources: data.sources?.length ? data.sources : undefined,
    });
    if (data.context) set({ context: { ...EMPTY_CONTEXT, ...data.context } });
    // Any other answer ends a pending "tap your location" request.
    if (data.command?.type !== "pick-start" && getNav().picking && data.command) nav.cancelPick();
    if (applyCommand(data.command)) set({ mapRequest: get().mapRequest + 1 });
  } catch {
    push({ from: "bot", text: "I couldn't reach the server. Check your connection and try again.", error: true });
  } finally {
    set({ busy: false });
  }
}

export const chat = {
  send(text: string) {
    const message = text.trim();
    if (!message || get().busy) return;
    push({ from: "me", text: message });
    void request({ message });
  },
  /** A tapped option: a place, or a message to send. */
  choose(option: ChatOption) {
    if (get().busy) return;
    if (option.message) return chat.send(option.message);
    if (!option.placeId) return;
    push({ from: "me", text: option.label + (option.sublabel ? ` (${option.sublabel})` : "") });
    void request({ event: { type: "choose", placeId: option.placeId } });
  },
  /** "Directions" pressed on a place card on the map. */
  directionsTo(placeId: string, name: string) {
    if (get().busy) return;
    push({ from: "me", text: `Take me to ${name}` });
    void request({ event: { type: "directions", placeId } });
  },
  reset() {
    set({ messages: [{ ...WELCOME, id: nextId++ }], context: EMPTY_CONTEXT });
    nav.clear();
  },
};

// Confirming a starting point on the map continues the conversation.
if (typeof window !== "undefined") {
  onStartConfirmed((startId) => {
    push({ from: "me", text: "📍 This is my starting point" });
    void request({ event: { type: "start-selected", startId } });
  });
}

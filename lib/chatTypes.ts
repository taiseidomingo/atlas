/**
 * Types shared by the chatbot API (server) and the chat / map UI (client).
 * Keep this file free of server-only imports.
 */

/** What the assistant is waiting for from the user. */
export type Awaiting = "start" | "directions-offer" | null;

/** Conversation state, kept by the client and sent back with each message. */
export interface ChatContext {
  /** Confirmed starting point (map node id). */
  startId: string | null;
  /** Current destination (map node id). */
  destinationId: string | null;
  /** Last place the assistant talked about ("show it", "take me there"). */
  lastPlaceId: string | null;
  /** The place before that ("go back to the previous location"). */
  previousPlaceId: string | null;
  awaiting: Awaiting;
  /** Places offered in the last "which one did you mean?" question. */
  options: string[];
  optionPurpose: "show" | "directions" | "start" | null;
}

export const EMPTY_CONTEXT: ChatContext = {
  startId: null,
  destinationId: null,
  lastPlaceId: null,
  previousPlaceId: null,
  awaiting: null,
  options: [],
  optionPurpose: null,
};

/** Something the map should do in response to a message. */
export type MapCommand =
  | { type: "show"; placeId: string }
  | { type: "set-start"; placeId: string }
  | { type: "route"; startId: string; destinationId: string }
  | { type: "pick-start"; destinationId: string | null }
  | { type: "clear" };

export interface ChatPlace {
  id: string;
  name: string;
  context: string;
  type: string;
}

/** A tappable choice under a message: a place, or a message to send. */
export interface ChatOption {
  label: string;
  sublabel?: string;
  placeId?: string;
  message?: string;
}

export interface ChatRoute {
  startId: string;
  destinationId: string;
  startName: string;
  destinationName: string;
  distance: number;
  minutes: number;
  steps: string[];
}

export interface ChatResponse {
  reply: string;
  context: ChatContext;
  command?: MapCommand | null;
  place?: ChatPlace | null;
  options?: ChatOption[];
  route?: ChatRoute | null;
  quickReplies?: string[];
  sources?: string[];
}

export type ChatEvent =
  /** The user confirmed their starting point on the map. */
  | { type: "start-selected"; startId: string }
  /** The user tapped one of the offered places. */
  | { type: "choose"; placeId: string }
  /** "Directions" was pressed for a place on the map. */
  | { type: "directions"; placeId: string };

export interface ChatRequest {
  message?: string;
  event?: ChatEvent;
  context?: Partial<ChatContext>;
}

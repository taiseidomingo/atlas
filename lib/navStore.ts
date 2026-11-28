"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared navigation state: what the map shows (start, destination, focused
 * place) and the "pick your starting point" mode. The chatbot and the map
 * page both read and write it, so a chatbot answer moves the real map and a
 * tap on the map continues the conversation.
 */

export interface NavState {
  start: string | null;
  dest: string | null;
  /** Place to fly to and highlight (changes nonce on every request). */
  focus: { id: string; nonce: number; mode?: "place" | "context" } | null;
  /** Bumped whenever the map should frame the whole route. */
  routeNonce: number;
  /** "Tap your current location on the map" mode. */
  picking: boolean;
  /** Place tapped while picking, waiting for the user to confirm. */
  candidate: string | null;
}

let state: NavState = {
  start: null,
  dest: null,
  focus: null,
  routeNonce: 0,
  picking: false,
  candidate: null,
};
let nonce = 0;

const listeners = new Set<() => void>();
const confirmListeners = new Set<(startId: string) => void>();

function set(patch: Partial<NavState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNav(): NavState {
  return state;
}

export function useNav(): NavState {
  return useSyncExternalStore(subscribe, getNav, getNav);
}

/** Called with the start id when the user confirms a starting point on the map. */
export function onStartConfirmed(listener: (startId: string) => void) {
  confirmListeners.add(listener);
  return () => {
    confirmListeners.delete(listener);
  };
}

export const nav = {
  setStart(id: string | null) {
    const both = !!id && !!state.dest && id !== state.dest;
    set({
      start: id,
      dest: id && id === state.dest ? null : state.dest,
      picking: false,
      candidate: null,
      routeNonce: both ? state.routeNonce + 1 : state.routeNonce,
      // No destination yet: show where the user is.
      focus: id && !both ? { id, nonce: ++nonce } : state.focus,
    });
  },
  setDest(id: string | null) {
    const both = !!id && !!state.start && id !== state.start;
    set({
      dest: id,
      start: id && id === state.start ? null : state.start,
      routeNonce: both ? state.routeNonce + 1 : state.routeNonce,
    });
  },
  swap() {
    set({ start: state.dest, dest: state.start, routeNonce: state.routeNonce + 1 });
  },
  /** Fly to a place and highlight it. */
  showPlace(id: string) {
    set({ focus: { id, nonce: ++nonce }, picking: false, candidate: null });
  },
  /** Show a route and frame it. */
  showRoute(start: string, dest: string) {
    set({
      start,
      dest,
      focus: null,
      picking: false,
      candidate: null,
      routeNonce: state.routeNonce + 1,
    });
  },
  /** Ask the user to tap their starting point; the destination stays marked. */
  beginPick(destination: string | null) {
    set({
      dest: destination ?? state.dest,
      // Show the campus around the destination, where starting points are tapped.
      focus: destination ? { id: destination, nonce: ++nonce, mode: "context" } : state.focus,
      picking: true,
      candidate: null,
    });
  },
  pick(id: string) {
    if (!state.picking) return;
    set({ candidate: id });
  },
  confirmPick() {
    const id = state.candidate;
    if (!id) return;
    const dest = id === state.dest ? null : state.dest;
    set({
      start: id,
      dest,
      picking: false,
      candidate: null,
      // With a destination the route is framed; without one, the start is.
      focus: dest ? null : { id, nonce: ++nonce },
      routeNonce: dest ? state.routeNonce + 1 : state.routeNonce,
    });
    confirmListeners.forEach((l) => l(id));
  },
  cancelPick() {
    set({ picking: false, candidate: null });
  },
  clear() {
    set({ start: null, dest: null, focus: null, picking: false, candidate: null });
  },
};

// Where Atlas keeps its shared data.
//
// - Local / any server with a disk: JSON files in data/ (the default).
// - Vercel (serverless, no disk): Upstash Redis. Adding Upstash Redis from the
//   Vercel "Storage" tab sets these variables automatically; nothing else to do.

export const kvUrl = (
  process.env.KV_REST_API_URL ??
  process.env.UPSTASH_REDIS_REST_URL ??
  ""
).replace(/\/+$/, "");
export const kvToken =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

/** True when a Redis store is configured; the data/ files are then not written. */
export const useKv = Boolean(kvUrl && kvToken);

/** Each store is saved under its own Redis key (see lib/persist.ts). */
export type StoreName = "state" | "teachers" | "faculty" | "knowledge";

const flags = globalThis as unknown as { atlasStoreDirty?: Set<StoreName> };

/** Called by the stores whenever their shared data changes. */
export function markDirty(store: StoreName = "state"): void {
  (flags.atlasStoreDirty ??= new Set()).add(store);
}

/** Returns which stores changed since the last call, and resets the flags. */
export function takeDirty(): StoreName[] {
  const dirty = [...(flags.atlasStoreDirty ?? [])];
  flags.atlasStoreDirty = new Set();
  return dirty;
}

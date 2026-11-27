import { kvPipeline } from "./kv";
import { takeDirty, useKv, type StoreName } from "./storeMode";
import { exportAdminState, importAdminState } from "./roomAdmin";
import { exportActivities, importActivities } from "./activityLog";
import { exportReservations, importReservations } from "./reservation";
import { exportTeacherAccounts, importTeacherAccounts } from "./teacherAccounts";
import { exportFaculty, importFaculty } from "./faculty";
import {
  cacheDocTexts,
  docsMissingText,
  exportKnowledgeIndex,
  importKnowledgeIndex,
  KV_TEXT_PREFIX,
  takeKnowledgeWrites,
} from "./knowledgeBase";

/**
 * Shared data on Vercel (Upstash Redis). Each store has its own key, so a
 * teacher claiming a room never overwrites an admin editing schedules:
 *
 *   atlas:state         room names, use counts, activity log, room claims
 *   atlas:teachers      faculty accounts (password hashes only)
 *   atlas:faculty       faculty schedules and department faculty areas
 *   atlas:kb:index      knowledge-base document list
 *   atlas:kb:text:<id>  extracted text of one document
 *   atlas:kb:file:<id>  original upload (base64), when small enough
 *
 * Without Redis (local / server with a disk) the stores use data/ files and
 * everything here is a no-op.
 */
const KEYS: Record<StoreName, string> = {
  state: "atlas:state",
  teachers: "atlas:teachers",
  faculty: "atlas:faculty",
  knowledge: "atlas:kb:index",
};

interface SharedState {
  names?: Record<string, string>;
  uses?: Record<string, number>;
  activities?: ReturnType<typeof exportActivities>;
  reservations?: ReturnType<typeof exportReservations>;
}

const SNAPSHOT: Record<StoreName, () => unknown> = {
  state: (): SharedState => {
    const { names, uses } = exportAdminState();
    return { names, uses, activities: exportActivities(), reservations: exportReservations() };
  },
  teachers: exportTeacherAccounts,
  faculty: exportFaculty,
  knowledge: exportKnowledgeIndex,
};

function parse(raw: unknown): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Load the latest shared data from Redis into memory (no-op without Redis). */
export async function loadSharedState(): Promise<void> {
  if (!useKv) return;
  // Drop leftovers from an earlier failed request. Changes made while loading
  // (e.g. releasing claims on rooms that are no longer claimable) are kept and saved.
  takeDirty();
  takeKnowledgeWrites();
  const [state, teachers, faculty, knowledge] = await kvPipeline([
    ["GET", KEYS.state],
    ["GET", KEYS.teachers],
    ["GET", KEYS.faculty],
    ["GET", KEYS.knowledge],
  ]);

  const shared = (parse(state) ?? {}) as SharedState;
  importAdminState(shared.names ?? {}, shared.uses ?? {});
  importActivities(shared.activities ?? []);
  importReservations(shared.reservations ?? []);
  importTeacherAccounts(parse(teachers));
  importFaculty(parse(faculty) as Parameters<typeof importFaculty>[0]);
  importKnowledgeIndex(parse(knowledge));

  // Document texts change rarely: fetch only those this instance lacks.
  const missing = docsMissingText();
  if (missing.length) {
    const texts = await kvPipeline(missing.map((doc) => ["GET", KV_TEXT_PREFIX + doc.id]));
    cacheDocTexts(missing.map((doc, i) => ({ doc, text: texts[i] })));
  }

}

/** Save the stores this request changed to Redis (no-op without Redis). */
export async function saveSharedState(): Promise<void> {
  if (!useKv) return;
  const dirty = takeDirty();
  const commands: (string | number)[][] = [
    ...takeKnowledgeWrites(),
    ...dirty.map((name) => ["SET", KEYS[name], JSON.stringify(SNAPSHOT[name]())]),
  ];
  await kvPipeline(commands);
}

/**
 * Wrap an API route handler so it always sees the latest shared data and
 * saves its changes. On a normal server (no Redis) it just runs the handler.
 */
export function withSharedState<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    if (!useKv) return handler(...args);
    try {
      await loadSharedState();
    } catch (error) {
      console.error("[persist] load failed", error);
      return Response.json(
        { error: "The data store is unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    const response = await handler(...args);
    try {
      await saveSharedState();
    } catch (error) {
      console.error("[persist] save failed", error);
      return Response.json(
        { error: "Your change could not be saved. Please try again." },
        { status: 503 },
      );
    }
    return response;
  };
}

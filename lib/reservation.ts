import { campusGraph, NodeId } from "./graph";
import { getRoomName, recordRoomUse } from "./roomAdmin";
import { finishRoomActivity, startRoomActivity } from "./activityLog";

export interface Reservation {
  nodeId: NodeId;
  roomName: string;
  professor: string;
  claimedAt: string;
  professorId?: string;
}

export type ClaimResult =
  | { ok: true; reservation: Reservation }
  | {
      ok: false;
      reason: "not_found" | "not_claimable" | "taken";
      heldBy?: string;
    };

const globalStore = globalThis as unknown as {
  atlasReservations?: Map<NodeId, Reservation>;
};

const reservations: Map<NodeId, Reservation> =
  globalStore.atlasReservations ??
  (globalStore.atlasReservations = new Map<NodeId, Reservation>());

// Release claims on locations that are no longer claimable (e.g. after a room
// was reclassified as an office), closing their activity log entries.
reservations.forEach((reservation, nodeId) => {
  if (!campusGraph.nodes.some((n) => n.id === nodeId && n.claimable)) {
    finishRoomActivity(nodeId, reservation.professor);
    reservations.delete(nodeId);
  }
});

export function claimRoom(
  nodeId: NodeId,
  professor: string,
  professorId = professor.trim().toLowerCase(),
): ClaimResult {
  const node = campusGraph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "not_found" };
  if (!node.claimable) return { ok: false, reason: "not_claimable" };

  const existing = reservations.get(nodeId);
  if (existing && existing.professor === professor) {
    return { ok: true, reservation: existing };
  }
  if (existing && existing.professor !== professor) {
    return { ok: false, reason: "taken", heldBy: existing.professor };
  }

  reservations.forEach((r, id) => {
    if (r.professor === professor && id !== nodeId) {
      finishRoomActivity(id, professor);
      reservations.delete(id);
    }
  });

  const reservation: Reservation = {
    nodeId,
    roomName: getRoomName(nodeId, node.name),
    professor,
    claimedAt: new Date().toISOString(),
    professorId,
  };
  reservations.set(nodeId, reservation);
  recordRoomUse(nodeId);
  startRoomActivity(nodeId, professor, professorId);
  return { ok: true, reservation };
}

export function releaseRoom(
  nodeId: NodeId,
  professor: string,
): "released" | "missing" | "not_yours" {
  const existing = reservations.get(nodeId);
  if (!existing) return "missing";
  if (existing.professor !== professor) return "not_yours";
  finishRoomActivity(nodeId, professor);
  reservations.delete(nodeId);
  return "released";
}

export function listReservations(): Reservation[] {
  return Array.from(reservations.values()).map((reservation) => ({
    ...reservation,
    roomName: getRoomName(
      reservation.nodeId,
      campusGraph.nodes.find((node) => node.id === reservation.nodeId)?.name ?? reservation.roomName,
    ),
  }));
}

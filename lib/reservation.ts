import { campusGraph, NodeId } from "./graph";

export interface Reservation {
  nodeId: NodeId;
  roomName: string;
  professor: string;
  claimedAt: string;
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

export function claimRoom(nodeId: NodeId, professor: string): ClaimResult {
  const node = campusGraph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "not_found" };
  if (!node.claimable) return { ok: false, reason: "not_claimable" };

  const existing = reservations.get(nodeId);
  if (existing && existing.professor !== professor) {
    return { ok: false, reason: "taken", heldBy: existing.professor };
  }

  // A professor can only be in one room: claiming a new one leaves the old one.
  reservations.forEach((r, id) => {
    if (r.professor === professor && id !== nodeId) reservations.delete(id);
  });

  const reservation: Reservation = {
    nodeId,
    roomName: node.name,
    professor,
    claimedAt: new Date().toISOString(),
  };
  reservations.set(nodeId, reservation);
  return { ok: true, reservation };
}

export function releaseRoom(
  nodeId: NodeId,
  professor: string,
): "released" | "missing" | "not_yours" {
  const existing = reservations.get(nodeId);
  if (!existing) return "missing";
  if (existing.professor !== professor) return "not_yours";
  reservations.delete(nodeId);
  return "released";
}

export function listReservations(): Reservation[] {
  return Array.from(reservations.values());
}

import { campusGraph, NodeId } from "./graph";

export interface Reservation {
  nodeId: NodeId;
  roomName: string;
  professor: string;
  claimedAt: string;
}

const globalStore = globalThis as unknown as {
  atlasReservations?: Map<NodeId, Reservation>;
};

const reservations: Map<NodeId, Reservation> =
  globalStore.atlasReservations ??
  (globalStore.atlasReservations = new Map<NodeId, Reservation>());

export type ClaimResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "not_found" | "not_claimable" };

export function claimRoom(nodeId: NodeId, professor: string): ClaimResult {
  const node = campusGraph.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "not_found" };
  if (!node.claimable) return { ok: false, reason: "not_claimable" };

  const reservation: Reservation = {
    nodeId,
    roomName: node.name,
    professor,
    claimedAt: new Date().toISOString(),
  };
  reservations.set(nodeId, reservation);
  return { ok: true, reservation };
}

export function releaseRoom(nodeId: NodeId): boolean {
  return reservations.delete(nodeId);
}

export function listReservations(): Reservation[] {
  return Array.from(reservations.values());
}

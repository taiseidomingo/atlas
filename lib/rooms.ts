import { campusGraph } from "./graph";
import { buildingById, buildingOfNode } from "./mapData";

export interface ClaimableRoom {
  id: string;
  name: string;
  place: string;
}

function placeOf(id: string, floor?: number): string {
  const b = buildingOfNode(id);
  const building = b ? buildingById[b].name : "Campus";
  return floor ? `${building}, Floor ${floor}` : building;
}

// Strictly rooms: only nodes flagged claimable (classrooms, faculty room, etc.).
// Halls, stairs, elevators, comfort rooms and offices are never listed.
export function listClaimableRooms(): ClaimableRoom[] {
  return campusGraph.nodes
    .filter((n) => n.claimable === true)
    .map((n) => ({ id: n.id, name: n.name, place: placeOf(n.id, n.floor) }))
    .sort(
      (a, b) =>
        a.place.localeCompare(b.place) ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
}

export function isClaimableRoom(id: string): boolean {
  return campusGraph.nodes.some((n) => n.id === id && n.claimable === true);
}

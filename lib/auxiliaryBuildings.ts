import type { GraphEdge, GraphNode } from "./graph";

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

function addBuilding(
  prefix: string,
  floor: number,
  rooms: { code: string; name: string }[],
  roomX = 270,
): void {
  const entranceId = `${prefix}-ENTRANCE`;
  const hallwayId = `${prefix}-${floor}-HALL`;
  nodes.push({
    id: hallwayId,
    name: `${prefix} ${floor}F hallway`,
    x: 230,
    y: 160,
    kind: "junction",
    floor,
    claimable: false,
  });

  let previous = hallwayId;
  rooms.forEach((room, index) => {
    const id = `${prefix}-${floor}-${room.code}`;
    nodes.push({
      id,
      name: room.name,
      x: roomX,
      y: 160 + index * 190,
      kind: "entrance",
      floor,
      claimable: true,
    });
    edges.push({ from: previous, to: id, weight: 2 });
    previous = id;
  });

  if (!nodes.some((node) => node.id === entranceId)) {
    nodes.push({
      id: entranceId,
      name: `${prefix} entrance`,
      x: 230,
      y: 160,
      kind: "gate",
      floor,
      claimable: false,
    });
  }
  edges.push({ from: entranceId, to: hallwayId, weight: 1 });
}

addBuilding("CTMO", 1, [
  { code: "1", name: "CTMO 1" },
  { code: "2", name: "CTMO 2" },
  { code: "3", name: "CTMO 3" },
  { code: "GAD", name: "GAD & Knowledge Management Center" },
  { code: "RESEARCH", name: "Research Development & Extension Office" },
], 500);

addBuilding("HM", 1, [
  { code: "101", name: "HM 101" },
  { code: "102", name: "HM 102" },
]);
addBuilding("HM", 2, [
  { code: "201", name: "HM 201" },
  { code: "202", name: "HM 202" },
]);
addBuilding("HM", 3, [
  { code: "301", name: "HM 301" },
  { code: "302", name: "HM 302" },
]);

addBuilding("CL-N", 1, [1, 2, 3, 4].map((n) => ({ code: `${n}`, name: `CL ${n}` })));
addBuilding("CL-S", 1, [5, 6, 7, 8].map((n) => ({ code: `${n}`, name: `CL ${n}` })));

export const auxiliaryBuildingNodes = nodes;
export const auxiliaryBuildingEdges = edges;

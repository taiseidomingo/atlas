import type { GraphEdge, GraphNode, NodeId } from "./graph";

const INDOOR_METERS_PER_PIXEL = 0.04;
const FLOOR_CHANGE_METERS = 8;

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

interface PlaceSpec {
  code: string;
  name: string;
  x: number;
  y: number;
  claimable?: boolean;
}

function find(id: NodeId): GraphNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`oldBuilding: no node with id "${id}"`);
  return node;
}

function link(from: NodeId, to: NodeId): void {
  const a = find(from);
  const b = find(to);
  const meters = Math.hypot(a.x - b.x, a.y - b.y) * INDOOR_METERS_PER_PIXEL;
  edges.push({ from, to, weight: Math.round(meters * 10) / 10 });
}

function addHall(floor: number, code: string, x: number, y: number): NodeId {
  const id = `OB-${floor}-${code}`;
  nodes.push({
    id,
    name: `Old Building ${floor}F hallway ${code}`,
    x,
    y,
    kind: "junction",
    floor,
    claimable: false,
  });
  return id;
}

function addPlace(floor: number, hallId: NodeId, place: PlaceSpec): void {
  const id = `OB-${floor}-${place.code}`;
  nodes.push({
    id,
    name: place.name,
    x: place.x,
    y: place.y,
    kind: "entrance",
    floor,
    claimable: place.claimable ?? false,
  });
  link(hallId, id);
}

const c1 = addHall(2, "C1", 700, 600);
const c2 = addHall(2, "C2", 700, 860);
const c3 = addHall(2, "C3", 700, 1016);
const c4 = addHall(2, "C4", 700, 1300);
const c5 = addHall(2, "C5", 700, 1480);
const e0 = addHall(2, "E0", 920, 860);
const e1 = addHall(2, "E1", 920, 777);
const e2 = addHall(2, "E2", 960, 1170);
const e3 = addHall(2, "E3", 960, 1335);

link(c1, c2);
link(c2, c3);
link(c3, c4);
link(c4, c5);
link(c2, e0);
link(e0, e1);
link(e0, e2);
link(e2, e3);
link(e3, c4);

addPlace(2, c1, {
  code: "CL-N",
  name: "CL Building north (Old Building)",
  x: 282,
  y: 559,
  claimable: true,
});
addPlace(2, c1, {
  code: "FACULTY",
  name: "Faculty Room (Old Building)",
  x: 745,
  y: 637,
  claimable: true,
});
addPlace(2, c3, {
  code: "FUNCTION",
  name: "Function Hall (Old Building)",
  x: 660,
  y: 1016,
});
addPlace(2, e1, {
  code: "LIBRARY",
  name: "Library (Old Building)",
  x: 967,
  y: 777,
});
addPlace(2, e2, {
  code: "STOCK1",
  name: "Stock Room 1 (Old Building)",
  x: 1005,
  y: 1124,
});
addPlace(2, e2, {
  code: "STOCK2",
  name: "Stock Room 2 (Old Building)",
  x: 1005,
  y: 1214,
});
addPlace(2, e3, {
  code: "CLASSROOM",
  name: "Classroom 2F (Old Building)",
  x: 1005,
  y: 1335,
  claimable: true,
});
addPlace(2, c5, {
  code: "ORG",
  name: "Organization Office (Old Building)",
  x: 843,
  y: 1482,
});
addPlace(2, c5, {
  code: "CL-S",
  name: "CL Building south (Old Building)",
  x: 282,
  y: 1473,
  claimable: true,
});

const stairs2 = addHall(2, "STAIRS", 700, 1100);
link(c3, stairs2);

const hall1 = addHall(1, "HALL", 450, 953);

const floor1Places: PlaceSpec[] = [
  { code: "HM", name: "HM Room", x: 150, y: 850, claimable: true },
  { code: "STOCK-A", name: "Stock Room A", x: 250, y: 700, claimable: true },
  { code: "STOCK-B", name: "Stock Room B", x: 350, y: 700, claimable: true },
  { code: "CLASS-A", name: "Classroom A", x: 450, y: 700, claimable: true },
  { code: "CLASS-B", name: "Classroom B", x: 550, y: 700, claimable: true },
  {
    code: "FACULTY-1F",
    name: "Faculty Room 1F",
    x: 650,
    y: 700,
    claimable: true,
  },
  { code: "CR-A", name: "CR A", x: 750, y: 700 },
  { code: "CR-B", name: "CR B", x: 800, y: 700 },
  {
    code: "CONFERENCE",
    name: "Conference Room",
    x: 900,
    y: 700,
    claimable: true,
  },
  { code: "SUPPLY", name: "Supply Office", x: 1000, y: 700, claimable: true },
  {
    code: "MULTIMEDIA",
    name: "Multimedia Room",
    x: 1050,
    y: 700,
    claimable: true,
  },
];

floor1Places.forEach((place) => addPlace(1, hall1, place));

const stairs1 = addHall(1, "STAIRS", 450, 1100);
link(hall1, stairs1);

nodes.push({
  id: "OB-1-ENTRANCE",
  name: "Old Building entrance",
  x: 450,
  y: 853,
  kind: "gate",
  floor: 1,
  claimable: false,
});
link("OB-1-ENTRANCE", hall1);

edges.push({ from: stairs1, to: stairs2, weight: FLOOR_CHANGE_METERS });

export const oldBuildingNodes: GraphNode[] = nodes;
export const oldBuildingEdges: GraphEdge[] = edges;

import type { GraphEdge, GraphNode, NodeId } from "./graph";

const INDOOR_METERS_PER_PIXEL = 0.04;

type Point = { x: number; y: number };

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

function pixelDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Edge weights are in meters, like every other indoor graph.
function meters(a: Point, b: Point): number {
  return Math.round(pixelDistance(a, b) * INDOOR_METERS_PER_PIXEL * 10) / 10;
}

function link(from: NodeId, to: NodeId): void {
  edges.push({ from, to, weight: meters(find(from), find(to)) });
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

/* ------------------------------------------------------------------ */
/* 2nd floor                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 1st floor: places and entrances                                     */
/* ------------------------------------------------------------------ */

const hall1 = addHall(1, "HALL", 450, 953);

const floor1Places: PlaceSpec[] = [
  {
    code: "CHEMISTRY",
    name: "Chemistry Lab RM 120",
    x: 230,
    y: 337,
    claimable: true,
  },
  {
    code: "HEALTH",
    name: "Health Science Lab RM 121",
    x: 330,
    y: 337,
    claimable: true,
  },
  {
    code: "BIOLOGY",
    name: "Biology Lab RM 122",
    x: 435,
    y: 337,
    claimable: true,
  },
  { code: "CLINIC", name: "Clinic", x: 585, y: 337 },
  {
    code: "STUDENT-GOV",
    name: "Student Government Office",
    x: 690,
    y: 418,
    claimable: true,
  },
  { code: "RM119", name: "RM 119", x: 410, y: 985, claimable: true },
  { code: "RM118", name: "RM 118", x: 410, y: 1090, claimable: true },
  { code: "RM115", name: "RM 115", x: 610, y: 985, claimable: true },
  { code: "RM114", name: "RM 114", x: 610, y: 1090, claimable: true },
  { code: "RADIO", name: "Radio Room", x: 725, y: 1040, claimable: true },
  { code: "RM117", name: "RM 117", x: 610, y: 1180, claimable: true },
  { code: "RM116", name: "RM 116", x: 610, y: 1280, claimable: true },
  { code: "RM112", name: "RM 112", x: 765, y: 1180, claimable: true },
  { code: "RM113", name: "RM 113", x: 765, y: 1280, claimable: true },
  { code: "HM", name: "HM LAB", x: 119, y: 907, claimable: true },
  { code: "STOCK-A", name: "Stock Room A", x: 222, y: 1108, claimable: true },
  { code: "STOCK-B", name: "Stock Room B", x: 119, y: 1064, claimable: true },
  { code: "CLASS-A", name: "RM 107", x: 560, y: 1155, claimable: true },
  { code: "CLASS-B", name: "RM 106", x: 557, y: 1068, claimable: true },
  { code: "CLASS-C", name: "RM 105", x: 470, y: 1356, claimable: true },
  { code: "CLASS-D", name: "RM 104", x: 363, y: 1356, claimable: true },
  { code: "CLASS-E", name: "RM 103", x: 286, y: 1356, claimable: true },
  {
    code: "FACULTY-1F",
    name: "Faculty Room 1F",
    x: 624,
    y: 1352,
    claimable: true,
  },
  { code: "CR-A", name: "CR A", x: 734, y: 1395 },
  { code: "CR-B", name: "CR B", x: 751, y: 1315 },
  {
    code: "CONFERENCE",
    name: "Conference Room",
    x: 838,
    y: 1328,
    claimable: true,
  },
  { code: "SUPPLY", name: "Supply Office", x: 928, y: 1359, claimable: true },
  {
    code: "MULTIMEDIA",
    name: "Multimedia Room",
    x: 1005,
    y: 1328,
    claimable: true,
  },
];

floor1Places.forEach((place) => addPlace(1, hall1, place));

nodes.push({
  id: "OB-1-ENTRANCE",
  name: "Old Building entrance",
  x: 888,
  y: 897,
  kind: "gate",
  floor: 1,
  claimable: false,
});
link("OB-1-ENTRANCE", hall1);

nodes.push(
  {
    id: "OB-1-CL-N-EXIT",
    name: "Exit to CL 5-8",
    x: 900,
    y: 1040,
    kind: "gate",
    floor: 1,
    claimable: false,
  },
  {
    id: "OB-1-CL-S-EXIT",
    name: "Exit to CL 1-4",
    x: 900,
    y: 1190,
    kind: "gate",
    floor: 1,
    claimable: false,
  },
);
link("OB-1-CL-N-EXIT", hall1);
link("OB-1-CL-S-EXIT", hall1);

// Positions on the floor-plan image (display coordinates before rotation).
const imagePositions: Record<string, Point> = {
  "OB-1-HALL": { x: 530, y: 585 }, // sits on the main walkway spine
  "OB-1-ENTRANCE": { x: 657, y: 738 }, // front wall, beside the security desk
  "OB-1-CL-N-EXIT": { x: 149.9, y: 397.1 }, // on exit door 4 (north side)
  "OB-1-CL-S-EXIT": { x: 149.9, y: 907.5 }, // on exit door 3 (south side)
  "OB-1-CHEMISTRY": { x: 230, y: 337 },
  "OB-1-HEALTH": { x: 330, y: 337 },
  "OB-1-BIOLOGY": { x: 436, y: 337 },
  "OB-1-CLINIC": { x: 587, y: 335 },
  "OB-1-STUDENT-GOV": { x: 691, y: 418 },
  "OB-1-RM119": { x: 231, y: 485 },
  "OB-1-RM118": { x: 231, y: 542 },
  "OB-1-RM115": { x: 389, y: 487 },
  "OB-1-RM114": { x: 389, y: 545 },
  "OB-1-RADIO": { x: 466, y: 786 },
  "OB-1-RM117": { x: 234, y: 758 },
  "OB-1-RM116": { x: 234, y: 817 },
  "OB-1-RM112": { x: 389, y: 760 },
  "OB-1-RM113": { x: 389, y: 817 },
  "OB-1-HM": { x: 95, y: 647 },
  "OB-1-STOCK-A": { x: 83, y: 758 },
  "OB-1-STOCK-B": { x: 84, y: 520 },
  "OB-1-CLASS-A": { x: 207, y: 963 },
  "OB-1-CLASS-B": { x: 264, y: 963 },
  "OB-1-CLASS-C": { x: 341, y: 963 },
  "OB-1-CLASS-D": { x: 444, y: 963 },
  "OB-1-CLASS-E": { x: 714, y: 935 },
  "OB-1-FACULTY-1F": { x: 444, y: 963 },
  "OB-1-CR-A": { x: 519, y: 1010 },
  "OB-1-CR-B": { x: 519, y: 930 },
  "OB-1-CONFERENCE": { x: 595, y: 935 },
  "OB-1-SUPPLY": { x: 663, y: 956 },
  "OB-1-MULTIMEDIA": { x: 714, y: 935 },
  "OB-2-C1": { x: 300, y: 380 },
  "OB-2-C2": { x: 300, y: 500 },
  "OB-2-C3": { x: 300, y: 680 },
  "OB-2-C4": { x: 300, y: 900 },
  "OB-2-C5": { x: 300, y: 1010 },
  "OB-2-E0": { x: 520, y: 650 },
  "OB-2-E1": { x: 520, y: 500 },
  "OB-2-E2": { x: 620, y: 780 },
  "OB-2-E3": { x: 620, y: 900 },
  "OB-2-CL-N": { x: 117, y: 378 },
  "OB-2-FACULTY": { x: 550, y: 450 },
  "OB-2-FUNCTION": { x: 135, y: 680 },
  "OB-2-LIBRARY": { x: 700, y: 530 },
  "OB-2-STOCK1": { x: 716, y: 767 },
  "OB-2-STOCK2": { x: 716, y: 830 },
  "OB-2-CLASSROOM": { x: 716, y: 913 },
  "OB-2-ORG": { x: 660, y: 1014 },
  "OB-2-CL-S": { x: 117, y: 1010 },
};

/* ------------------------------------------------------------------ */
/* 1st floor: walkable network                                         */
/* ------------------------------------------------------------------ */

// Each group is a polyline of walkable points, in walking order.
const walkablePointGroups = [
  [38, 39, 40],
  [41, 42, 43, 44, 40, 45, 46, 47, 48, 49, 50, 51, 52, 56, 53, 54, 55],
  [56, 57, 58, 59, 60, 61, 62, 63, 64],
  [65, 66, 67, 68, 69, 70, 71, 72],
  [73, 74, 76, 75],
  [77, 78, 79],
  [84, 83, 60, 82, 81, 78, 77],
  [86, 84, 85],
  [87, 88, 89, 90, 91],
  [92, 93, 94, 95],
  [96, 87],
] as const;

// Points clicked on the map with "Build map nodes". They are straightened
// by the snap calls below, so small click errors don't matter.
const walkablePointCoordinates: Record<number, Point> = {
  38: { x: 616.3, y: 705.1 },
  39: { x: 577.3, y: 702.6 },
  40: { x: 539.6, y: 701.4 },
  41: { x: 618.8, y: 585.7 },
  42: { x: 579.8, y: 584.4 },
  43: { x: 535.8, y: 585.7 },
  44: { x: 537.1, y: 648.6 },
  45: { x: 535.8, y: 747.9 },
  46: { x: 532.1, y: 790.6 },
  47: { x: 532.1, y: 845.9 },
  48: { x: 528.3, y: 878.6 },
  49: { x: 483, y: 879.9 },
  50: { x: 429, y: 879.9 },
  51: { x: 376.2, y: 878.6 },
  52: { x: 324.6, y: 877.4 },
  53: { x: 263, y: 876.1 },
  54: { x: 208.9, y: 876.1 },
  55: { x: 162.4, y: 874.9 },
  56: { x: 308.3, y: 844.7 },
  57: { x: 305.8, y: 803.2 },
  58: { x: 303.2, y: 751.6 },
  59: { x: 305.8, y: 690 },
  60: { x: 305.8, y: 651.1 },
  61: { x: 308.3, y: 612.1 },
  62: { x: 302, y: 560.6 },
  63: { x: 307, y: 511.5 },
  64: { x: 307, y: 467.5 },
  65: { x: 152.4, y: 432.3 },
  66: { x: 207.7, y: 434.8 },
  67: { x: 254.2, y: 432.3 },
  68: { x: 299.5, y: 433.6 },
  69: { x: 358.6, y: 434.8 },
  70: { x: 393.8, y: 434.8 },
  71: { x: 449.1, y: 433.6 },
  72: { x: 490.6, y: 433.6 },
  73: { x: 520.7, y: 394.6 },
  74: { x: 522, y: 439.9 },
  75: { x: 529.5, y: 541.7 },
  76: { x: 525.8, y: 488.9 },
  77: { x: 501.9, y: 651.1 },
  78: { x: 465.4, y: 653.6 },
  79: { x: 460.4, y: 701.4 },
  80: { x: 459.1, y: 613.4 },
  81: { x: 415.1, y: 654.8 },
  82: { x: 362.3, y: 654.8 },
  83: { x: 258, y: 652.3 },
  84: { x: 211.5, y: 653.6 },
  85: { x: 208.9, y: 700.1 },
  86: { x: 215.2, y: 607.1 },
  87: { x: 589.9, y: 737.8 },
  88: { x: 588.6, y: 780.6 },
  89: { x: 588.6, y: 823.3 },
  90: { x: 626.3, y: 840.9 },
  91: { x: 650.2, y: 867.3 },
  92: { x: 588.6, y: 545.5 },
  93: { x: 584.9, y: 502.7 },
  94: { x: 589.9, y: 470 },
  95: { x: 620.1, y: 472.5 },
  96: { x: 586.1, y: 648.6 },
};

// Snap the walkway to straight horizontal / vertical lines.
// x/y are building coordinates; the map draws them rotated 90 degrees.
function snapX(numbers: number[], x: number): void {
  numbers.forEach((n) => {
    walkablePointCoordinates[n].x = x;
  });
}

function snapY(numbers: number[], y: number): void {
  numbers.forEach((n) => {
    walkablePointCoordinates[n].y = y;
  });
}

// main spine (the long line drawn top to bottom)
snapX([73, 74, 76, 75, 43, 44, 40, 45, 46, 47, 48], 530);
snapY([41, 42, 43], 585); // branch to door 2
snapY([38, 39, 40, 79], 703); // branch to door 1
snapY([75, 92], 543); // link from the spine to the right column

// bottom corridor
snapY([48, 49, 50, 51, 52, 56, 53, 54, 55], 878);

// top corridor
snapY([65, 66, 67, 68, 69, 70, 71, 72, 74], 434);

// left vertical corridor
snapX([56, 57, 58, 59, 60, 61, 62, 63, 64, 68], 306);

// middle horizontal corridor
snapY([84, 83, 60, 82, 81, 78, 77, 44, 96], 650);
snapX([78, 79, 80], 462);

// far-left vertical
snapX([84, 85, 86], 211);

// right column
snapX([92, 93, 94], 588);
snapY([94, 95], 471);
snapX([96, 87, 88, 89], 588);
snapY([89, 90], 823);
snapX([90, 91], 626);

const walkableNodes: GraphNode[] = Object.entries(walkablePointCoordinates).map(
  ([number, position]) => ({
    id: `OB-1-P${number.padStart(2, "0")}`,
    name: `Old Building 1F walkable node ${number}`,
    ...position,
    kind: "junction",
    floor: 1,
    claimable: false,
  }),
);

const doorPointCoordinates: Record<number, Point> = {
  1: { x: 650.7, y: 701.4 },
  2: { x: 650.5, y: 583.2 },
  3: { x: 149.9, y: 907.5 },
  4: { x: 149.9, y: 397.1 },
  5: { x: 689.2, y: 876.1 },
  6: { x: 646.2, y: 895 },
  7: { x: 556.7, y: 881.1 },
  8: { x: 504.9, y: 972.9 },
  9: { x: 416.6, y: 908.8 },
  10: { x: 317.1, y: 908.8 },
  11: { x: 181, y: 936.5 },
  12: { x: 272.8, y: 908.8 },
  13: { x: 458.4, y: 736.6 },
  14: { x: 338.9, y: 770.5 },
  15: { x: 283.6, y: 769.2 },
  16: { x: 282.4, y: 829.6 },
  17: { x: 338.9, y: 828.3 },
  18: { x: 279.9, y: 558 },
  19: { x: 335.2, y: 561.8 },
  20: { x: 279.9, y: 495.2 },
  21: { x: 340.2, y: 497.7 },
  22: { x: 175.5, y: 686.3 },
  23: { x: 178, y: 604.6 },
  24: { x: 73.7, y: 583.2 },
  25: { x: 458.4, y: 574.4 },
  27: { x: 622.6, y: 421 },
  28: { x: 646.5, y: 418.5 },
  29: { x: 649, y: 359.4 },
  30: { x: 621.3, y: 314.1 },
  31: { x: 522, y: 344.3 },
  32: { x: 407.6, y: 393.3 },
  33: { x: 465.4, y: 394.6 },
  34: { x: 295.7, y: 394.6 },
  35: { x: 354.8, y: 395.9 },
  36: { x: 198.9, y: 395.9 },
  37: { x: 255.5, y: 398.4 },
};

const doorNodes: GraphNode[] = Object.entries(doorPointCoordinates).map(
  ([number, position]) => ({
    id: `OB-1-D${number.padStart(2, "0")}`,
    name:
      Number(number) <= 4
        ? `Old Building 1F exit door ${number}`
        : `Old Building 1F door ${number}`,
    ...position,
    kind: "junction",
    floor: 1,
    claimable: false,
  }),
);

function walkableNodeId(number: number): NodeId {
  return `OB-1-P${number.toString().padStart(2, "0")}`;
}

function doorNodeId(number: number): NodeId {
  return `OB-1-D${number.toString().padStart(2, "0")}`;
}

const walkableEdges: GraphEdge[] = [];

function linkWalkable(from: number, to: number): void {
  walkableEdges.push({
    from: walkableNodeId(from),
    to: walkableNodeId(to),
    weight: meters(
      walkablePointCoordinates[from],
      walkablePointCoordinates[to],
    ),
  });
}

for (const group of walkablePointGroups) {
  for (let index = 1; index < group.length; index += 1) {
    linkWalkable(group[index - 1], group[index]);
  }
}

const connectingWalkableEdges: [number, number][] = [
  [64, 68],
  [72, 74],
  [75, 43],
  [75, 92],
  [44, 96],
  [78, 80],
  [79, 40],
  [77, 44], // middle corridor meets the main spine
];
for (const [from, to] of connectingWalkableEdges) {
  linkWalkable(from, to);
}

// Which walkway point each door opens onto.
const doorPathConnections: Record<number, number> = {
  1: 38,
  2: 41,
  3: 55,
  4: 65,
  5: 91,
  6: 91,
  7: 48,
  8: 48,
  9: 50,
  10: 52,
  11: 55,
  12: 53,
  13: 79,
  14: 58,
  15: 58,
  16: 57,
  17: 56,
  18: 62,
  19: 62,
  20: 63,
  21: 63,
  22: 85,
  23: 86,
  24: 86,
  25: 80,
  27: 95,
  28: 95,
  29: 95,
  30: 95,
  31: 73,
  32: 69,
  33: 72,
  34: 68,
  35: 69,
  36: 65,
  37: 67,
};

const doorPathEdges: GraphEdge[] = Object.entries(doorPathConnections).map(
  ([doorNumber, pathNumber]) => {
    const door = doorNodes.find(
      (node) => node.id === doorNodeId(Number(doorNumber)),
    );
    const path = walkableNodes.find(
      (node) => node.id === walkableNodeId(pathNumber),
    );
    if (!door || !path) {
      throw new Error(
        `oldBuilding: invalid door/path connection ${doorNumber} -> ${pathNumber}`,
      );
    }
    return { from: door.id, to: path.id, weight: meters(door, path) };
  },
);

// Sanity check: every door and walkway point must reach exit doors 1-4.
const networkIds = new Set<NodeId>(
  [...walkableNodes, ...doorNodes].map((node) => node.id),
);
const adjacency = new Map<NodeId, Set<NodeId>>(
  [...networkIds].map((id) => [id, new Set<NodeId>()]),
);
for (const edge of [...walkableEdges, ...doorPathEdges]) {
  adjacency.get(edge.from)?.add(edge.to);
  adjacency.get(edge.to)?.add(edge.from);
}

const reachable = new Set<NodeId>();
const pending: NodeId[] = [1, 2, 3, 4].map(doorNodeId);
while (pending.length > 0) {
  const id = pending.pop();
  if (!id || reachable.has(id)) continue;
  reachable.add(id);
  pending.push(...(adjacency.get(id) ?? []));
}
if (reachable.size !== networkIds.size) {
  throw new Error(
    "oldBuilding: every valid door and pathway node must reach exit doors 1-4",
  );
}

/* ------------------------------------------------------------------ */
/* Final graph                                                         */
/* ------------------------------------------------------------------ */

const positionedNodes = nodes.map((node) => {
  const position = imagePositions[node.id];
  return position ? { ...node, ...position } : node;
});

const positionedNodeById = new Map(
  positionedNodes.map((node) => [node.id, node]),
);

// Rooms and entrances on 1F connect to the nearest door, not to the hall.
const floor1AccessibleNodeIds = new Set(
  positionedNodes
    .filter(
      (node) =>
        node.floor === 1 && (node.kind === "entrance" || node.kind === "gate"),
    )
    .map((node) => node.id),
);

function nearestDoorNode(nodeId: string): GraphNode {
  const node = positionedNodeById.get(nodeId);
  if (!node) throw new Error(`oldBuilding: no node with id "${nodeId}"`);
  return doorNodes.reduce((nearest, candidate) =>
    pixelDistance(node, candidate) < pixelDistance(node, nearest)
      ? candidate
      : nearest,
  );
}

// These gates sit on the building edge and join the network at a fixed point,
// so no path ever runs outside the building.
const networkNodeById = new Map(
  [...walkableNodes, ...doorNodes].map((node) => [node.id, node]),
);
const fixedAccess: Record<string, NodeId> = {
  "OB-1-ENTRANCE": walkableNodeId(87),
  "OB-1-CL-N-EXIT": doorNodeId(4),
  "OB-1-CL-S-EXIT": doorNodeId(3),
};

const roomDoorEdges: GraphEdge[] = [];
for (const roomId of floor1AccessibleNodeIds) {
  const room = positionedNodeById.get(roomId);
  if (!room) continue;
  const target =
    networkNodeById.get(fixedAccess[roomId] ?? "") ?? nearestDoorNode(roomId);
  roomDoorEdges.push({
    from: roomId,
    to: target.id,
    weight: meters(room, target),
  });
}

const hallWalkableEdge: GraphEdge = {
  from: hall1,
  to: walkableNodeId(43),
  weight: meters(imagePositions[hall1], walkablePointCoordinates[43]),
};

const directRoomEdges = edges.filter(
  (edge) =>
    !(edge.from === hall1 && floor1AccessibleNodeIds.has(edge.to)) &&
    !(edge.to === hall1 && floor1AccessibleNodeIds.has(edge.from)),
);

export const oldBuildingNodes: GraphNode[] = [
  ...positionedNodes,
  ...walkableNodes,
  ...doorNodes,
];

export const oldBuildingEdges: GraphEdge[] = [
  ...directRoomEdges,
  ...walkableEdges,
  ...doorPathEdges,
  ...roomDoorEdges,
  hallWalkableEdge,
];

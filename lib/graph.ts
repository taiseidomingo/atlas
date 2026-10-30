import { newBuildingNodes, newBuildingEdges } from "./newBuilding";
import { oldBuildingNodes, oldBuildingEdges } from "./oldBuilding";

export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  kind: "junction" | "gate" | "entrance";
  claimable?: boolean;
  floor?: number;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  weight: number; // meters
}

export interface CampusGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const METERS_PER_PIXEL = 0.1136;

const nodes: GraphNode[] = [
  // Top Row
  {
    id: "node1",
    name: "node1",
    x: 160,
    y: 420,
    kind: "junction",
  },
  {
    id: "node2",
    name: "node2",
    x: 260,
    y: 420,
    kind: "junction",
  },
  {
    id: "node3",
    name: "node3",
    x: 420,
    y: 420,
    kind: "junction",
  },
  {
    id: "node4",
    name: "node4",
    x: 540,
    y: 420,
    kind: "junction",
  },
  {
    id: "node5",
    name: "node5",
    x: 660,
    y: 420,
    kind: "junction",
  },
  {
    id: "node6",
    name: "node6",
    x: 840,
    y: 420,
    kind: "junction",
  },

  // Left Column
  {
    id: "node7",
    name: "node7",
    x: 160,
    y: 650,
    kind: "junction",
  },
  {
    id: "node8",
    name: "node8",
    x: 160,
    y: 950,
    kind: "junction",
  },
  {
    id: "node9",
    name: "node9",
    x: 160,
    y: 1250,
    kind: "junction",
  },
  {
    id: "node10",
    name: "node10",
    x: 160,
    y: 1450,
    kind: "junction",
  },

  // Center Column
  {
    id: "node11",
    name: "node11",
    x: 510,
    y: 620,
    kind: "junction",
  },
  {
    id: "node12",
    name: "node12",
    x: 510,
    y: 850,
    kind: "junction",
  },
  {
    id: "node13",
    name: "node13",
    x: 510,
    y: 1100,
    kind: "junction",
  },
  {
    id: "node14",
    name: "node14",
    x: 510,
    y: 1350,
    kind: "junction",
  },

  // Right Column
  {
    id: "node15",
    name: "node15",
    x: 840,
    y: 650,
    kind: "junction",
  },
  {
    id: "node16",
    name: "node16",
    x: 840,
    y: 950,
    kind: "junction",
  },
  {
    id: "node17",
    name: "node17",
    x: 840,
    y: 1250,
    kind: "junction",
  },
  {
    id: "node18",
    name: "node18",
    x: 840,
    y: 1450,
    kind: "junction",
  },

  // Bottom Row
  {
    id: "node19",
    name: "node19",
    x: 300,
    y: 1450,
    kind: "junction",
  },
  {
    id: "node20",
    name: "node20",
    x: 420,
    y: 1450,
    kind: "junction",
  },
  {
    id: "node21",
    name: "node21",
    x: 540,
    y: 1450,
    kind: "junction",
  },
  {
    id: "node22",
    name: "node22",
    x: 660,
    y: 1450,
    kind: "junction",
  },

  // --- GATES ---
  {
    id: "Gate 2",
    name: "Gate 2",
    x: 576,
    y: 343,
    kind: "gate",
  },
  {
    id: "Gate 1",
    name: "Gate 1",
    x: 580,
    y: 1651,
    kind: "gate",
  },

  // --- BUILDINGS & LANDMARKS ---
  {
    id: "HM Building",
    name: "HM Building",
    x: 155,
    y: 507,
    kind: "entrance",
  },
  {
    id: "CR",
    name: "CR",
    x: 266,
    y: 507,
    kind: "entrance",
  },
  {
    id: "Benches",
    name: "Benches",
    x: 406,
    y: 493,
    kind: "entrance",
  },

  {
    id: "CTMO building",
    name: "CTMO building",
    x: 610,
    y: 549,
    kind: "entrance",
  },

  // Old Building Exits
  {
    id: "Old Bldg Front",
    name: "Old Building Front Door",
    x: 450,
    y: 1011,
    kind: "entrance",
  },
  {
    id: "Old Bldg Door North",
    name: "Old Building Door (North)",
    x: 256,
    y: 753,
    kind: "entrance",
  },
  {
    id: "Old Bldg Door South",
    name: "Old Building Door (South)",
    x: 256,
    y: 1288,
    kind: "entrance",
  },

  {
    id: "CL Room 5-8",
    name: "CL Room 5-8",
    x: 246,
    y: 664,
    kind: "entrance",
  },
  {
    id: "CL Room 1-4",
    name: "CL Room 1-4",
    x: 246,
    y: 1386,
    kind: "entrance",
  },
  {
    id: "Maintenance room",
    name: "Maintenance room",
    x: 85,
    y: 852,
    kind: "entrance",
  },
  {
    id: "Canteen area",
    name: "Canteen area",
    x: 85,
    y: 1250,
    kind: "entrance",
  },

  {
    id: "Gymnasium",
    name: "Gymnasium",
    x: 640,
    y: 1015,
    kind: "entrance",
  },
  {
    id: "Learning Room",
    name: "Learning Room",
    x: 336,
    y: 1537,
    kind: "entrance",
  },
  {
    id: "Smart Room",
    name: "Smart Room",
    x: 640,
    y: 1490,
    kind: "entrance",
  },
  {
    id: "New Building",
    name: "New Building",
    x: 958,
    y: 995,
    kind: "entrance",
  },

  // Gym Stairs
  {
    id: "Gym Stairs South",
    name: "Stairs (Gym South)",
    x: 864,
    y: 1248,
    kind: "entrance",
  },
  {
    id: "Gym Stairs North",
    name: "Stairs (Gym North)",
    x: 864,
    y: 620,
    kind: "entrance",
  },
];

function edge(from: NodeId, to: NodeId): GraphEdge {
  const a = nodes.find((n) => n.id === from);
  const b = nodes.find((n) => n.id === to);

  if (!a) throw new Error(`edge(): no node with id "${from}"`);
  if (!b) throw new Error(`edge(): no node with id "${to}"`);

  const meters = Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PIXEL;
  return { from, to, weight: Math.round(meters * 10) / 10 };
}

export const campusGraph: CampusGraph = {
  nodes: [...nodes, ...newBuildingNodes, ...oldBuildingNodes],
  edges: [
    // Grid Connections
    edge("node1", "node2"),
    edge("node2", "node3"),
    edge("node3", "node4"),
    edge("node4", "node5"),
    edge("node5", "node6"),
    edge("node10", "node19"),
    edge("node19", "node20"),
    edge("node20", "node21"),
    edge("node21", "node22"),
    edge("node22", "node18"),

    edge("node1", "node7"),
    edge("node7", "node8"),
    edge("node8", "node9"),
    edge("node9", "node10"),
    edge("node4", "node11"),
    edge("node11", "node12"),
    edge("node12", "node13"),
    edge("node13", "node14"),
    edge("node14", "node21"),
    edge("node6", "node15"),
    edge("node15", "node16"),
    edge("node16", "node17"),
    edge("node17", "node18"),

    // Cross Connections
    edge("node2", "node11"),
    edge("node3", "node11"),
    edge("node7", "node11"),
    edge("node8", "node12"),
    edge("node5", "node15"),
    edge("node12", "node16"),
    edge("node13", "node17"),

    // Gates
    edge("Gate 2", "node3"),
    edge("Gate 1", "node21"),

    // Building Connections
    edge("node7", "HM Building"),
    edge("node2", "CR"),
    edge("node3", "Benches"),
    edge("node15", "CTMO building"),
    edge("node12", "Old Bldg Front"),

    // Old Building Doors
    edge("node7", "Old Bldg Door North"),
    edge("node9", "Old Bldg Door South"),

    edge("node7", "CL Room 5-8"),
    edge("node10", "CL Room 1-4"),
    edge("node8", "Maintenance room"),
    edge("node9", "Canteen area"),
    edge("node13", "Gymnasium"),
    edge("node20", "Learning Room"),
    edge("node22", "Smart Room"),
    edge("node16", "New Building"),

    // Gym Stairs
    edge("node15", "Gym Stairs North"),
    edge("node17", "Gym Stairs South"),

    ...newBuildingEdges,
    ...oldBuildingEdges,
    { from: "NB-1-ENTRANCE", to: "New Building", weight: 6 },
    { from: "OB-1-ENTRANCE", to: "Old Bldg Front", weight: 6 },
  ],
};

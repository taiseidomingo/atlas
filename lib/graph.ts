export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  kind: "junction" | "gate" | "entrance";
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
  {
    id: "Gate 2",
    name: "Gate 2",
    x: 218,
    y: 168,
    kind: "gate",
  },
  {
    id: "Northwest corner",
    name: "Northwest corner",
    x: 105,
    y: 187,
    kind: "junction",
  },
  {
    id: "West path (north)",
    name: "West path (north)",
    x: 76,
    y: 262,
    kind: "junction",
  },
  {
    id: "Maintenance room",
    name: "Maintenance room",
    x: 70,
    y: 350,
    kind: "entrance",
  },
  {
    id: "Canteen area",
    name: "Canteen area",
    x: 70,
    y: 520,
    kind: "entrance",
  },
  {
    id: "Southwest corner",
    name: "Southwest corner",
    x: 75,
    y: 630,
    kind: "junction",
  },
  {
    id: "Learning Room",
    name: "Learning Room",
    x: 150,
    y: 632,
    kind: "entrance",
  },
  {
    id: "Center path (south)",
    name: "Center path (south)",
    x: 218,
    y: 632,
    kind: "junction",
  },
  {
    id: "Gate 1",
    name: "Gate 1",
    x: 218,
    y: 680,
    kind: "gate",
  },
  {
    id: "Smart Room",
    name: "Smart Room",
    x: 285,
    y: 680,
    kind: "entrance",
  },
  {
    id: "Southeast corner",
    name: "Southeast corner",
    x: 343,
    y: 678,
    kind: "junction",
  },
  {
    id: "East path (south)",
    name: "East path (south)",
    x: 336,
    y: 525,
    kind: "junction",
  },
  {
    id: "East path (north)",
    name: "East path (north)",
    x: 335,
    y: 330,
    kind: "junction",
  },
  {
    id: "Northeast corner",
    name: "Northeast corner",
    x: 325,
    y: 190,
    kind: "junction",
  },
  {
    id: "CTMO building",
    name: "CTMO building",
    x: 280,
    y: 288,
    kind: "entrance",
  },
  {
    id: "Center path (north)",
    name: "Center path (north)",
    x: 220,
    y: 230,
    kind: "junction",
  },
  {
    id: "Center path (middle)",
    name: "Center path (middle)",
    x: 220,
    y: 450,
    kind: "junction",
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
  nodes,
  edges: [
    edge("Gate 2", "Northwest corner"),
    edge("Gate 2", "Northeast corner"),
    edge("Gate 2", "Center path (north)"),
    edge("Northwest corner", "West path (north)"),
    edge("West path (north)", "Maintenance room"),
    edge("Maintenance room", "Canteen area"),
    edge("Canteen area", "Southwest corner"),
    edge("Southwest corner", "Learning Room"),
    edge("Learning Room", "Center path (south)"),
    edge("Center path (south)", "Gate 1"),
    edge("Gate 1", "Smart Room"),
    edge("Smart Room", "Southeast corner"),
    edge("Southeast corner", "East path (south)"),
    edge("East path (south)", "East path (north)"),
    edge("East path (north)", "Northeast corner"),
    edge("East path (north)", "CTMO building"),
    edge("CTMO building", "Center path (north)"),
    edge("Center path (north)", "Center path (middle)"),
    edge("Center path (middle)", "Center path (south)"),
  ],
};

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
  { id: "GATE2", name: "Gate 2", x: 218, y: 168, kind: "gate" },
  { id: "NW", name: "Northwest corner", x: 105, y: 187, kind: "junction" },
  { id: "W1", name: "West path (north)", x: 76, y: 262, kind: "junction" },
  { id: "MAINT", name: "Maintenance", x: 70, y: 350, kind: "entrance" },
  { id: "CANTEEN", name: "Canteen", x: 70, y: 520, kind: "entrance" },
  { id: "SW", name: "Southwest corner", x: 75, y: 630, kind: "junction" },
  { id: "LEARN", name: "Learning Room", x: 150, y: 632, kind: "entrance" },
  { id: "C3", name: "Center path (south)", x: 218, y: 632, kind: "junction" },
  { id: "GATE1", name: "Gate 1", x: 218, y: 680, kind: "gate" },
  { id: "SMART", name: "Smart Room", x: 285, y: 680, kind: "entrance" },
  { id: "SE", name: "Southeast corner", x: 343, y: 678, kind: "junction" },
  { id: "E2", name: "East path (south)", x: 336, y: 525, kind: "junction" },
  { id: "E1", name: "East path (north)", x: 335, y: 330, kind: "junction" },
  { id: "NE", name: "Northeast corner", x: 325, y: 190, kind: "junction" },
  { id: "CTMO", name: "CTMO", x: 280, y: 288, kind: "entrance" },
  { id: "C1", name: "Center path (north)", x: 220, y: 230, kind: "junction" },
  { id: "C2", name: "Center path (middle)", x: 220, y: 450, kind: "junction" },
];

function edge(from: NodeId, to: NodeId): GraphEdge {
  const a = nodes.find((n) => n.id === from)!;
  const b = nodes.find((n) => n.id === to)!;
  const meters = Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PIXEL;
  return { from, to, weight: Math.round(meters * 10) / 10 };
}

export const campusGraph: CampusGraph = {
  nodes,
  edges: [
    edge("GATE2", "NW"),
    edge("GATE2", "NE"),
    edge("GATE2", "C1"),
    edge("NW", "W1"),
    edge("W1", "MAINT"),
    edge("MAINT", "CANTEEN"),
    edge("CANTEEN", "SW"),
    edge("SW", "LEARN"),
    edge("LEARN", "C3"),
    edge("C3", "GATE1"),
    edge("GATE1", "SMART"),
    edge("SMART", "SE"),
    edge("SE", "E2"),
    edge("E2", "E1"),
    edge("E1", "NE"),
    edge("E1", "CTMO"),
    edge("CTMO", "C1"),
    edge("C1", "C2"),
    edge("C2", "C3"),
  ],
};

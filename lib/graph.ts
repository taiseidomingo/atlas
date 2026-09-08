export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  claimed: boolean;
  claimedBy: string | null;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  weight: number;
}

export interface CampusGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const campusGraph: CampusGraph = {
  nodes: [
    {
      id: "A",
      name: "Main entrance",
      x: 0,
      y: 0,
      claimed: false,
      claimedBy: null,
    },
    {
      id: "B",
      name: "Hallway 1",
      x: 10,
      y: 0,
      claimed: false,
      claimedBy: null,
    },
    { id: "C", name: "Room 101", x: 20, y: 0, claimed: false, claimedBy: null },
    {
      id: "D",
      name: "Room 102",
      x: 10,
      y: 10,
      claimed: false,
      claimedBy: null,
    },
  ],
  edges: [
    { from: "A", to: "B", weight: 10 },
    { from: "B", to: "C", weight: 10 },
    { from: "B", to: "D", weight: 10 },
  ],
};

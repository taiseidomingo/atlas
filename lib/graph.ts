import { newBuildingNodes, newBuildingEdges } from "./newBuilding";
import { oldBuildingNodes, oldBuildingEdges } from "./oldBuilding";
import {
  auxiliaryBuildingNodes,
  auxiliaryBuildingEdges,
} from "./auxiliaryBuildings";

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
  weight: number;
}

export interface CampusGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}


export const METERS_PER_PIXEL = 0.17;



const outdoorNodes: GraphNode[] = [
  { id: "Gate 2", name: "Gate 2", x: 218, y: 168, kind: "gate" },
  {
    id: "Top path (west)",
    name: "Top path (west)",
    x: 98,
    y: 185,
    kind: "junction",
  },

  { id: "Benches", name: "Benches", x: 183, y: 185, kind: "entrance" },
  {
    id: "Top path (center)",
    name: "Top path (center)",
    x: 229,
    y: 185,
    kind: "junction",
  },
  {
    id: "CTMO building",
    name: "CTMO building",
    x: 263,
    y: 185,
    kind: "entrance",
  },
  {
    id: "Northeast corner",
    name: "Northeast corner",
    x: 339,
    y: 185,
    kind: "junction",
  },

  {
    id: "Northwest corner",
    name: "Northwest corner",
    x: 98,
    y: 254,
    kind: "junction",
  },

  {
    id: "Comfort room",
    name: "Comfort room",
    x: 98,
    y: 221,
    kind: "entrance",
  },
  {
    id: "West path (north)",
    name: "West path (north)",
    x: 72,
    y: 254,
    kind: "junction",
  },
  {
    id: "Maintenance room",
    name: "Maintenance room",
    x: 72,
    y: 366,
    kind: "entrance",
  },
  { id: "Canteen area", name: "Canteen area", x: 72, y: 540, kind: "entrance" },
  {
    id: "Southwest corner",
    name: "Southwest corner",
    x: 72,
    y: 629,
    kind: "junction",
  },


  {
    id: "Center path (top)",
    name: "Center path (top)",
    x: 229,
    y: 292,
    kind: "junction",
  },
  {
    id: "Center path (north)",
    name: "Center path (north)",
    x: 221,
    y: 298,
    kind: "junction",
  },

  { id: "Gymnasium", name: "Gymnasium", x: 221, y: 380, kind: "entrance" },
  {
    id: "Center path (middle)",
    name: "Center path (middle)",
    x: 220,
    y: 450,
    kind: "junction",
  },
  {
    id: "East path (north)",
    name: "East path (north)",
    x: 339,
    y: 292,
    kind: "junction",
  },
  {
    id: "East path (south)",
    name: "East path (south)",
    x: 339,
    y: 525,
    kind: "junction",
  },


  {
    id: "Center path (south)",
    name: "Center path (south)",
    x: 220,
    y: 597,
    kind: "junction",
  },

  { id: "Stage", name: "Stage", x: 250, y: 597, kind: "entrance" },
  { id: "Smart Room", name: "Smart Room", x: 277, y: 597, kind: "entrance" },
  {
    id: "East path (lower)",
    name: "East path (lower)",
    x: 339,
    y: 597,
    kind: "junction",
  },
  {
    id: "Southeast corner",
    name: "Southeast corner",
    x: 339,
    y: 629,
    kind: "junction",
  },


  {
    id: "Learning Room",
    name: "Learning Room",
    x: 146,
    y: 629,
    kind: "entrance",
  },
  {
    id: "Center path (lower)",
    name: "Center path (lower)",
    x: 220,
    y: 629,
    kind: "junction",
  },
  { id: "Gate 1", name: "Gate 1", x: 220, y: 690, kind: "gate" },
];

const outdoorById = new Map(outdoorNodes.map((n) => [n.id, n]));

function edge(from: NodeId, to: NodeId): GraphEdge {
  const a = outdoorById.get(from);
  const b = outdoorById.get(to);
  if (!a || !b) throw new Error(`edge(): unknown node "${!a ? from : to}"`);
  const meters = Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PIXEL;
  return { from, to, weight: Math.round(meters * 10) / 10 };
}

const outdoorEdges: GraphEdge[] = [
  edge("Gate 2", "Top path (center)"),
  edge("Top path (west)", "Benches"),
  edge("Benches", "Top path (center)"),
  edge("Top path (center)", "CTMO building"),
  edge("CTMO building", "Northeast corner"),
  edge("Top path (west)", "Comfort room"),
  edge("Comfort room", "Northwest corner"),
  edge("Northwest corner", "West path (north)"),
  edge("West path (north)", "Maintenance room"),
  edge("Maintenance room", "Canteen area"),
  edge("Canteen area", "Southwest corner"),

  edge("Top path (center)", "Center path (top)"),
  edge("Center path (top)", "Center path (north)"),
  edge("Center path (north)", "Gymnasium"),
  edge("Gymnasium", "Center path (middle)"),
  edge("Center path (middle)", "Center path (south)"),
  edge("Center path (south)", "Center path (lower)"),
  edge("Center path (lower)", "Gate 1"),

  edge("Center path (top)", "East path (north)"),
  edge("Northeast corner", "East path (north)"),
  edge("East path (north)", "East path (south)"),
  edge("East path (south)", "East path (lower)"),
  edge("East path (lower)", "Southeast corner"),

  edge("Center path (south)", "Stage"),
  edge("Stage", "Smart Room"),
  edge("Smart Room", "East path (lower)"),

  edge("Southwest corner", "Learning Room"),
  edge("Learning Room", "Center path (lower)"),
];

export const campusGraph: CampusGraph = {
  nodes: [
    ...outdoorNodes,
    ...newBuildingNodes,
    ...oldBuildingNodes,
    ...auxiliaryBuildingNodes,
  ],
  edges: [
    ...outdoorEdges,
    ...newBuildingEdges,
    ...oldBuildingEdges,
    ...auxiliaryBuildingEdges,
    { from: "NB-1-ENTRANCE", to: "East path (south)", weight: 6 },
    { from: "OB-1-ENTRANCE", to: "Center path (middle)", weight: 6 },
    { from: "OB-1-CL-N-EXIT", to: "CL-N-ENTRANCE", weight: 2 },
    { from: "OB-1-CL-S-EXIT", to: "CL-S-ENTRANCE", weight: 2 },
    { from: "CTMO-ENTRANCE", to: "CTMO building", weight: 1 },
    { from: "HM-ENTRANCE", to: "Top path (west)", weight: 5 },
    { from: "CL-N-ENTRANCE", to: "OB-2-CL-N", weight: 1 },
    { from: "CL-S-ENTRANCE", to: "OB-2-CL-S", weight: 1 },
  ],
};

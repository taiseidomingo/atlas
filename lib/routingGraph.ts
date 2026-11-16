import { campusGraph, CampusGraph, GraphEdge, GraphNode } from "./graph";
import { buildingOfNode } from "./mapData";

// Walkable paths get a node roughly every STEP_METERS so routes follow the real
// walkway and GPS positions snap to a point at most about a meter away.
export const STEP_METERS = 1;

function frameOf(node: GraphNode): string {
  const b = buildingOfNode(node.id);
  return b ? `${b}:${node.floor ?? 1}` : "outside";
}

function densify(graph: CampusGraph): CampusGraph {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes: GraphNode[] = [...graph.nodes];
  const edges: GraphEdge[] = [];

  graph.edges.forEach((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    const pieces = Math.max(1, Math.round(e.weight / STEP_METERS));
    if (!a || !b || pieces === 1 || frameOf(a) !== frameOf(b)) {
      edges.push(e);
      return;
    }

    let prev = a.id;
    for (let i = 1; i < pieces; i++) {
      const t = i / pieces;
      const id = `${a.id}~${b.id}~${i}`;
      nodes.push({
        id,
        name: id,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        kind: "junction",
        floor: a.floor,
      });
      edges.push({ from: prev, to: id, weight: e.weight / pieces });
      prev = id;
    }
    edges.push({ from: prev, to: b.id, weight: e.weight / pieces });
  });

  return { nodes, edges };
}

export const routingGraph: CampusGraph = densify(campusGraph);
export const routingNodeById = new Map(
  routingGraph.nodes.map((n) => [n.id, n]),
);

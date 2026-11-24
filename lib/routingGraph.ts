import { campusGraph, CampusGraph } from "./graph";

export const routingGraph: CampusGraph = campusGraph;
export const routingNodeById = new Map(
  routingGraph.nodes.map((n) => [n.id, n]),
);

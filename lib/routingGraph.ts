import { campusGraph } from "./graph";
import type { CampusGraph } from "./graph";

/**
 * The graph used for routing and for drawing walkable paths.
 *
 * It is exactly the traced graph from ./graph.ts: the path that is drawn on
 * screen and the path the router uses are the same edges. Disconnected path
 * groups are NOT bridged here any more (the old 1000px "shortest bridge"
 * could cut through walls); a dev-time check reports them instead.
 */
export const routingGraph: CampusGraph = campusGraph;

export const routingNodeById = new Map(
  routingGraph.nodes.map((node) => [node.id, node]),
);

if (process.env.NODE_ENV !== "production") {
  const adj = new Map<string, string[]>();
  for (const e of routingGraph.edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const start = "Gate 1";
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of adj.get(queue.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = routingGraph.nodes.filter(
    (n) => n.kind !== "junction" && !seen.has(n.id),
  );
  if (unreachable.length > 0) {
    console.warn(
      `[routingGraph] not reachable from ${start}: ` +
        unreachable.map((n) => n.id).join(", "),
    );
  }
}

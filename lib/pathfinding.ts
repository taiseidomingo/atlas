import { CampusGraph, NodeId } from "./graph";

interface DijkstraResult {
  path: NodeId[];
  distance: number;
}

export function findShortestPath(
  graph: CampusGraph,
  startId: NodeId,
  endId: NodeId,
): DijkstraResult | null {
  const adjacency = new Map<NodeId, { neighbor: NodeId; weight: number }[]>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({ neighbor: edge.to, weight: edge.weight });
    adjacency.get(edge.to)?.push({ neighbor: edge.from, weight: edge.weight });
  }

  const distances = new Map<NodeId, number>();
  const previous = new Map<NodeId, NodeId | null>();
  const unvisited = new Set<NodeId>();

  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
    unvisited.add(node.id);
  }
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    let currentId: NodeId | null = null;
    let smallestDistance = Infinity;

    for (const id of unvisited) {
      const dist = distances.get(id)!;
      if (dist < smallestDistance) {
        smallestDistance = dist;
        currentId = id;
      }
    }

    if (currentId === null) break;
    if (currentId === endId) break;

    unvisited.delete(currentId);

    const neighbors = adjacency.get(currentId) ?? [];
    for (const { neighbor, weight } of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      const candidateDistance = distances.get(currentId)! + weight;
      if (candidateDistance < distances.get(neighbor)!) {
        distances.set(neighbor, candidateDistance);
        previous.set(neighbor, currentId);
      }
    }
  }

  if (distances.get(endId) === Infinity) {
    return null;
  }

  const path: NodeId[] = [];
  let step: NodeId | null = endId;
  while (step !== null) {
    path.unshift(step);
    step = previous.get(step) ?? null;
  }

  return { path, distance: distances.get(endId)! };
}

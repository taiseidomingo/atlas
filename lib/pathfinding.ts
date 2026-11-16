import { CampusGraph, NodeId } from "./graph";

interface DijkstraResult {
  path: NodeId[];
  distance: number;
}

interface QueueEntry {
  id: NodeId;
  distance: number;
}

class MinPriorityQueue {
  private readonly entries: QueueEntry[] = [];

  push(entry: QueueEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.entries[parent].distance <= this.entries[index].distance) break;
      [this.entries[parent], this.entries[index]] = [
        this.entries[index],
        this.entries[parent],
      ];
      index = parent;
    }
  }

  pop(): QueueEntry | undefined {
    if (this.entries.length === 0) return undefined;
    const first = this.entries[0];
    const last = this.entries.pop();
    if (last && this.entries.length > 0) {
      this.entries[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < this.entries.length &&
          this.entries[left].distance < this.entries[smallest].distance
        ) {
          smallest = left;
        }
        if (
          right < this.entries.length &&
          this.entries[right].distance < this.entries[smallest].distance
        ) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.entries[index], this.entries[smallest]] = [
          this.entries[smallest],
          this.entries[index],
        ];
        index = smallest;
      }
    }
    return first;
  }
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
    if (edge.weight < 0) {
      throw new Error(`pathfinding: negative edge weight on ${edge.from} -> ${edge.to}`);
    }
    adjacency.get(edge.from)?.push({ neighbor: edge.to, weight: edge.weight });
    adjacency.get(edge.to)?.push({ neighbor: edge.from, weight: edge.weight });
  }

  const distances = new Map<NodeId, number>();
  const previous = new Map<NodeId, NodeId | null>();

  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
  }
  distances.set(startId, 0);

  const queue = new MinPriorityQueue();
  queue.push({ id: startId, distance: 0 });

  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === endId) break;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const { neighbor, weight } of neighbors) {
      const candidateDistance = current.distance + weight;
      if (candidateDistance < distances.get(neighbor)!) {
        distances.set(neighbor, candidateDistance);
        previous.set(neighbor, current.id);
        queue.push({ id: neighbor, distance: candidateDistance });
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

import { campusGraph, METERS_PER_PIXEL } from "./graph";
import type { CampusGraph, GraphEdge, GraphNode } from "./graph";

const MAX_BRIDGE_DISTANCE_PX = 1000;

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array(size).fill(0);
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value]);
    }

    return this.parent[value];
  }

  union(a: number, b: number): boolean {
    let rootA = this.find(a);
    let rootB = this.find(b);

    if (rootA === rootB) {
      return false;
    }

    if (this.rank[rootA] < this.rank[rootB]) {
      [rootA, rootB] = [rootB, rootA];
    }

    this.parent[rootB] = rootA;

    if (this.rank[rootA] === this.rank[rootB]) {
      this.rank[rootA]++;
    }

    return true;
  }
}

function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function edgeWeight(distancePx: number): number {
  return Math.max(0.1, Math.round(distancePx * METERS_PER_PIXEL * 10) / 10);
}

function connectDisconnectedDotGroups(
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphEdge[] {
  const result = [...edges];
  const edgeKeys = new Set(result.map((edge) => edgeKey(edge.from, edge.to)));

  function addEdge(from: string, to: string, distancePx: number) {
    const key = edgeKey(from, to);

    if (edgeKeys.has(key) || from === to) {
      return;
    }

    edgeKeys.add(key);

    result.push({
      from,
      to,
      weight: edgeWeight(distancePx),
    });
  }

  const dotsByMap = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const match = node.id.match(/^(.+)-DOT-\d+$/);

    if (!match) {
      continue;
    }

    const mapPrefix = match[1];
    const group = dotsByMap.get(mapPrefix) ?? [];

    group.push(node);
    dotsByMap.set(mapPrefix, group);
  }

  for (const [mapPrefix, dots] of dotsByMap) {
    if (dots.length < 2) {
      continue;
    }

    const indexById = new Map<string, number>();

    dots.forEach((node, index) => {
      indexById.set(node.id, index);
    });

    const unionFind = new UnionFind(dots.length);

    // Preserve all existing connections between path dots.
    for (const edge of edges) {
      const fromIndex = indexById.get(edge.from);
      const toIndex = indexById.get(edge.to);

      if (fromIndex !== undefined && toIndex !== undefined) {
        unionFind.union(fromIndex, toIndex);
      }
    }

    // Find the shortest possible connections between disconnected groups.
    const candidates: {
      fromIndex: number;
      toIndex: number;
      distance: number;
    }[] = [];

    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const from = dots[i];
        const to = dots[j];

        const distance = Math.hypot(from.x - to.x, from.y - to.y);

        if (distance <= MAX_BRIDGE_DISTANCE_PX) {
          candidates.push({
            fromIndex: i,
            toIndex: j,
            distance,
          });
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);

    // Kruskal-style minimum spanning connections:
    // only add an edge when it joins two different components.
    for (const candidate of candidates) {
      const joined = unionFind.union(candidate.fromIndex, candidate.toIndex);

      if (!joined) {
        continue;
      }

      const from = dots[candidate.fromIndex];
      const to = dots[candidate.toIndex];

      addEdge(from.id, to.id, candidate.distance);
    }

    const remainingComponents = new Set(
      dots.map((_, index) => unionFind.find(index)),
    );

    if (remainingComponents.size > 1) {
      console.warn(
        `[routingGraph] ${mapPrefix} still has ` +
          `${remainingComponents.size} disconnected path groups. ` +
          `Add a manually verified connection for this map.`,
      );
    }
  }

  return result;
}

export const routingGraph: CampusGraph = {
  nodes: campusGraph.nodes,
  edges: connectDisconnectedDotGroups(campusGraph.nodes, campusGraph.edges),
};

export const routingNodeById = new Map(
  routingGraph.nodes.map((node) => [node.id, node]),
);

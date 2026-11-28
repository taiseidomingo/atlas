import type { NodeId } from "./graph";
import { findShortestPath } from "./pathfinding";
import { routingGraph, routingNodeById } from "./routingGraph";
import { buildingById, buildingOfNode } from "./mapData";
import type { BuildingId } from "./mapData";

/**
 * Route computation and plain-language directions, shared by the map
 * (client) and the chatbot (server) so both always describe the same path.
 */

/** Average walking speed used for time estimates, in metres per minute. */
export const WALK_METERS_PER_MIN = 78;

export interface NameLookup {
  place: (id: string, fallback: string) => string;
  building: (id: BuildingId, fallback: string) => string;
  floor: (id: BuildingId, floor: number, fallback: string) => string;
}

export interface RouteLeg {
  label: string;
  building: BuildingId | null;
  floor: number | null;
  distance: number;
}

export interface RouteGuide {
  startId: string;
  destinationId: string;
  path: NodeId[];
  distance: number;
  minutes: number;
  legs: RouteLeg[];
  steps: string[];
}

const edgeWeight = new Map<string, number>();
for (const e of routingGraph.edges) {
  edgeWeight.set(e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`, e.weight);
}

function weightBetween(a: string, b: string): number {
  return edgeWeight.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0;
}

/**
 * Shortest walkable path. Two places in the same building are routed inside
 * that building only, so a route never leaves and re-enters a building.
 */
export function computePath(
  startId: string | null | undefined,
  destId: string | null | undefined,
): { path: NodeId[]; distance: number } | null {
  if (!startId || !destId || startId === destId) return null;
  if (!routingNodeById.has(startId) || !routingNodeById.has(destId)) return null;
  const startBuilding = buildingOfNode(startId);
  const sameBuilding =
    startBuilding !== null && startBuilding === buildingOfNode(destId);
  const graph = sameBuilding
    ? {
        nodes: routingGraph.nodes.filter((n) => buildingOfNode(n.id) === startBuilding),
        edges: routingGraph.edges.filter(
          (e) =>
            buildingOfNode(e.from) === startBuilding &&
            buildingOfNode(e.to) === startBuilding,
        ),
      }
    : routingGraph;
  return findShortestPath(graph, startId, destId);
}

function floorFallback(b: BuildingId, floor: number): string {
  const plan = buildingById[b].floors.find((f) => f.floor === floor);
  return plan?.name ?? `Floor ${floor}`;
}

function segmentLabel(names: NameLookup, b: BuildingId | null, floor: number | null): string {
  if (!b) return "Campus grounds";
  const building = names.building(b, buildingById[b].name);
  return `${building}, ${names.floor(b, floor ?? 1, floorFallback(b, floor ?? 1))}`;
}

/** Name of any node, including unnamed path points (a pinned spot). */
export function nodeLabel(names: NameLookup, id: string): string {
  const n = routingNodeById.get(id);
  if (!n) return id;
  if (n.kind === "junction") return "your pinned location";
  return names.place(id, n.name).replace(/\s*\n\s*/g, " ");
}

function meters(d: number): string {
  return d < 10 ? `${Math.max(1, Math.round(d))} m` : `${Math.round(d / 5) * 5} m`;
}

/** Route between two places with legs and step-by-step directions. */
export function buildRouteGuide(
  startId: string,
  destId: string,
  names: NameLookup,
): RouteGuide | null {
  const result = computePath(startId, destId);
  if (!result) return null;
  const { path, distance } = result;

  // Group the path into segments: campus grounds, or one floor of one building.
  type Segment = {
    key: string;
    building: BuildingId | null;
    floor: number | null;
    ids: string[];
    distance: number;
  };
  const segments: Segment[] = [];
  path.forEach((id, i) => {
    const n = routingNodeById.get(id)!;
    const b = buildingOfNode(id);
    const floor = b ? n.floor ?? 1 : null;
    const key = b ? `${b}:${floor}` : "outside";
    const last = segments[segments.length - 1];
    const step = i > 0 ? weightBetween(path[i - 1], id) : 0;
    if (last && last.key === key) {
      last.ids.push(id);
      last.distance += step;
    } else {
      // The step that moves between segments (a doorway or stairs) is counted
      // in the segment it leads into.
      segments.push({ key, building: b, floor, ids: [id], distance: step });
    }
  });

  const legs: RouteLeg[] = segments.map((s) => ({
    label: segmentLabel(names, s.building, s.floor),
    building: s.building,
    floor: s.floor,
    distance: s.distance,
  }));

  const startName = nodeLabel(names, startId);
  const destName = nodeLabel(names, destId);
  const steps: string[] = [];
  steps.push(
    `Start at ${startName}${segments[0].building ? ` (${legs[0].label})` : ""}.`,
  );

  segments.forEach((seg, i) => {
    const prev = segments[i - 1];
    const next = segments[i + 1];
    const isLast = !next;
    const target = isLast
      ? destName
      : next.building && next.building !== seg.building
      ? `the ${names.building(next.building, buildingById[next.building].name)} entrance`
      : !next.building
      ? "the exit"
      : nodeLabel(names, seg.ids[seg.ids.length - 1]);

    if (prev) {
      if (seg.building && prev.building === seg.building) {
        const via = nodeLabel(names, prev.ids[prev.ids.length - 1]);
        const dir =
          (seg.floor ?? 1) > (prev.floor ?? 1) ? "up" : (seg.floor ?? 1) < (prev.floor ?? 1) ? "down" : "";
        const floorName = names.floor(
          seg.building,
          seg.floor ?? 1,
          floorFallback(seg.building, seg.floor ?? 1),
        );
        const stairs = via.replace(/^the /i, "");
        steps.push(
          /\bto\b/i.test(stairs)
            ? `Take the ${stairs}${dir ? ` (${dir})` : ""}.`
            : `Take the ${stairs}${dir ? ` ${dir}` : ""} to ${floorName}.`,
        );
      } else if (seg.building) {
        steps.push(
          `Enter the ${names.building(seg.building, buildingById[seg.building].name)}` +
            (buildingById[seg.building].floors.length > 1
              ? ` (${names.floor(seg.building, seg.floor ?? 1, floorFallback(seg.building, seg.floor ?? 1))}).`
              : "."),
        );
      } else if (prev.building) {
        steps.push(
          `Exit the ${names.building(prev.building, buildingById[prev.building].name)} onto the campus grounds.`,
        );
      }
    }

    if (seg.distance >= 1 || isLast) {
      const where = seg.building ? "Follow the hallway" : "Walk along the campus walkway";
      steps.push(
        seg.distance >= 1
          ? `${where} for about ${meters(seg.distance)} to ${target}.`
          : `${destName} is right there.`,
      );
    }
  });

  steps.push(`Arrive at ${destName}${legs[legs.length - 1].building ? ` (${legs[legs.length - 1].label})` : ""}.`);

  return {
    startId,
    destinationId: destId,
    path,
    distance,
    minutes: Math.max(1, Math.round(distance / WALK_METERS_PER_MIN)),
    legs,
    steps,
  };
}

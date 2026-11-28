import { campusGraph } from "./graph";
import { buildingById, buildingOfNode, buildings, campusShapes } from "./mapData";
import type { BuildingId } from "./mapData";
import type { NameLookup } from "./routeGuide";

/**
 * Searchable index of every place on the campus map (gates, buildings,
 * rooms, offices, stairs). Only nodes that exist in the routing graph are
 * indexed, so anything this returns has verified map coordinates.
 */

export interface Place {
  id: string;
  name: string;
  /** "Old Building, 2nd Floor" or "Campus grounds". */
  context: string;
  type: string;
  building: BuildingId | null;
  floor: number | null;
  /** Normalised token lists for each name the place is known by. */
  aliases: string[][];
  /** Tokens of the building / floor, used only to break ties. */
  contextTokens: string[];
  /** Lower ranks win ties (rooms before stairs, etc.). */
  rank: number;
  /** The map's original name when it differs from the display name ("CR (West Upper)"). */
  detail?: string;
}

export interface PlaceCard {
  id: string;
  name: string;
  context: string;
  type: string;
}

export function toCard(p: Place): PlaceCard {
  return { id: p.id, name: p.name, context: p.context, type: p.type };
}

// Words that say what the user wants, not which place.
const STOP = new Set(
  (
    "a an the to of in at on is are was be am i me my we you your it its this that there here " +
    "where wheres how what which who do does did can could would will should please pls kindly " +
    "find locate located location show see view get go going goes take bring lead guide navigate " +
    "navigation direction directions route way path map campus pin point highlight give tell " +
    "know need want looking look for with near nearest closest from currently now right just " +
    "im i'm am also and or but then so ok okay hi hello hey thanks thank yes no " +
    "saan nasaan asan nasan ang ng sa po paano pumunta papunta makapunta yung mga dito " +
    "reach whats where's m re ll ve d s t inside outside beside"
  ).split(/\s+/),
);

// Words too generic to identify a place on their own.
const GENERIC = new Set(["office", "room", "lab", "area", "hall", "unit", "center", "centre", "department", "floor", "building"]);

const SYNONYM: Record<string, string> = {
  rm: "room",
  rooms: "room",
  laboratory: "lab",
  laboratories: "lab",
  labs: "lab",
  dept: "department",
  departments: "department",
  bldg: "building",
  blg: "building",
  restroom: "cr",
  restrooms: "cr",
  toilet: "cr",
  toilets: "cr",
  bathroom: "cr",
  comfortroom: "cr",
  washroom: "cr",
  cafeteria: "canteen",
  gym: "gymnasium",
  elevators: "elevator",
  lift: "elevator",
  stair: "stairs",
  staircase: "stairs",
  offices: "office",
  gates: "gate",
  registrars: "registrar",
  deans: "dean",
  cashiers: "cashier",
  libraries: "library",
  "1st": "1",
  "2nd": "2",
  "3rd": "3",
  "4th": "4",
  "5th": "5",
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
};

/** Lower-case word tokens with synonyms applied ("Registrar's Office" -> registrar office). */
export function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/comfort\s+rooms?/g, "cr")
    .replace(/[’']s\b/g, "")
    .replace(/&/g, " and ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ");
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => SYNONYM[w] ?? w);
}

function significant(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP.has(t));
}

// Map nodes that stand for the same real place (a building and its door).
const SAME_PLACE: Record<string, string> = {
  "CTMO building": "CTMO-ENTRANCE",
  "HM building": "HM-ENTRANCE",
  "CL North": "CL-N-ENTRANCE",
  "CL South": "CL-S-ENTRANCE",
  // The gymnasium's floor plan door answers to "Gymnasium" too; the court
  // on the campus map is the place people mean.
  "GYM-ENTRANCE": "Gymnasium",
};

export function samePlaceKey(id: string): string {
  return SAME_PLACE[id] ?? id;
}

function rankOf(id: string, name: string): number {
  if (/stairs|elevator/i.test(name)) return 3;
  if (/entrance$/i.test(name) || id.endsWith("-ENTRANCE")) return 1;
  if (/^(Exit|Walkway) to/i.test(name)) return 4;
  return 0;
}

const outdoorTypes = new Map(
  campusShapes.filter((s) => s.nodeId).map((s) => [s.nodeId as string, s.type]),
);

function floorFallback(b: BuildingId, floor: number): string {
  return buildingById[b].floors.find((f) => f.floor === floor)?.name ?? `Floor ${floor}`;
}

/** Every routable place, named with the current (admin-managed) names. */
export function buildPlaceIndex(names: NameLookup): Place[] {
  const places: Place[] = [];
  for (const n of campusGraph.nodes) {
    if (n.kind === "junction") continue;
    const b = buildingOfNode(n.id);
    const name = names.place(n.id, n.name).replace(/\s*\n\s*/g, " ").trim();
    const aliasNames = new Set([name, n.name, name.replace(/\s*\([^)]*\)\s*$/, ""), n.name.replace(/\s*\([^)]*\)\s*$/, "")]);
    let type = "Location";
    let context = "Campus grounds";
    let contextTokens: string[] = ["campus", "grounds", "outside"];
    if (b) {
      const building = names.building(b, buildingById[b].name);
      const floorName = names.floor(b, n.floor ?? 1, floorFallback(b, n.floor ?? 1));
      context = buildingById[b].floors.length > 1 ? `${building}, ${floorName}` : building;
      contextTokens = significant(tokenize(`${building} ${buildingById[b].name} ${floorName} floor ${n.floor ?? 1}`));
      const room = buildingById[b].floors
        .find((f) => f.floor === n.floor)
        ?.rooms.find((r) => r.nodeId === n.id);
      type = room?.type ?? (n.id.endsWith("-ENTRANCE") ? "Building entrance" : /stairs|elevator/i.test(n.name) ? "Stairs / elevator" : "Room");
      if (n.id === buildingById[b].entranceId) {
        // "Old Building", "Gymnasium" … resolve to the building's main door.
        aliasNames.add(building);
        aliasNames.add(buildingById[b].name);
      }
    } else {
      type = outdoorTypes.get(n.id) ?? (n.kind === "gate" ? "Campus gate" : "Location");
    }
    places.push({
      id: n.id,
      name,
      context,
      type,
      building: b,
      floor: b ? n.floor ?? 1 : null,
      aliases: [...aliasNames].map((a) => significant(tokenize(a))).filter((a) => a.length > 0),
      contextTokens,
      rank: rankOf(n.id, n.name),
      detail: n.name.toLowerCase() !== name.toLowerCase() ? n.name : undefined,
    });
  }
  // Outdoor building blocks (e.g. "HM building") also answer to the
  // building's display name.
  for (const bld of buildings) {
    const outdoor = Object.entries(SAME_PLACE).find(([, door]) => door === bld.entranceId)?.[0];
    if (!outdoor) continue;
    const place = places.find((p) => p.id === outdoor);
    if (place) place.aliases.push(significant(tokenize(names.building(bld.id, bld.name))));
  }
  return places;
}

export interface ScoredPlace {
  place: Place;
  score: number;
  /** Share of the question's words this place explains (1 = all of them). */
  precision: number;
  /** Share of the place's distinctive name words found in the question. */
  coverage: number;
}

/** Ranked matches for a free-text place description. */
export function scorePlaces(query: string, index: Place[]): ScoredPlace[] {
  const q = significant(tokenize(query));
  if (q.length === 0) return [];
  const qSet = new Set(q);
  const numbers = q.filter((t) => /^\d+$/.test(t));
  const results: ScoredPlace[] = [];
  const isNum = (t: string) => /^\d+$/.test(t);

  for (const place of index) {
    let best: ScoredPlace | null = null;
    for (const alias of place.aliases) {
      const aliasNumbers = alias.filter(isNum);
      // A number in the question ("Room 204", "CL 5") must appear in the name.
      if (numbers.length > 0 && !numbers.every((num) => aliasNumbers.includes(num))) continue;
      const hits = alias.filter((t) => qSet.has(t));
      const specific = hits.filter((t) => !GENERIC.has(t) && !isNum(t));
      if (hits.length === 0) continue;
      // Generic words alone ("office") don't identify a place, but a number does.
      if (specific.length === 0 && !(numbers.length > 0 && aliasNumbers.length > 0)) continue;
      // Distinctive words count fully; generic words and unasked numbers a little.
      const weight = (t: string) =>
        GENERIC.has(t) || (isNum(t) && numbers.length === 0) ? 0.3 : 1;
      const total = alias.reduce((sum, t) => sum + weight(t), 0);
      const found = alias.filter((t) => qSet.has(t)).reduce((sum, t) => sum + weight(t), 0);
      const coverage = total > 0 ? found / total : 0;
      const explained = q.reduce(
        (sum, t) =>
          sum + (alias.includes(t) || place.contextTokens.includes(t) ? 1 : GENERIC.has(t) ? 0.5 : 0),
        0,
      );
      const precision = explained / q.length;
      const exact = alias.length === q.length && alias.every((t) => qSet.has(t)) ? 0.05 : 0;
      const score = coverage * 0.65 + precision * 0.35 + exact - place.rank * 0.01;
      if (!best || score > best.score) best = { place, score, precision, coverage };
    }
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score || a.place.rank - b.place.rank);
}

export type PlaceResolution =
  | { kind: "found"; place: Place }
  | { kind: "ambiguous"; options: Place[] }
  | { kind: "none"; suggestions: Place[] };

const ACCEPT = 0.74;

// Strong overall match, or every word of the question explained by the name.
const accepted = (s: ScoredPlace) =>
  s.score >= ACCEPT || (s.precision >= 0.999 && s.coverage >= 0.4);

/** Resolve a description to one verified place, a short list to choose from, or nothing. */
export function resolvePlace(query: string, index: Place[]): PlaceResolution {
  const scored = scorePlaces(query, index);
  const top = scored[0];
  if (!top || !accepted(top)) {
    return { kind: "none", suggestions: scored.filter((s) => s.score >= 0.3).slice(0, 4).map((s) => s.place) };
  }
  const close = scored.filter((s) => accepted(s) && top.score - s.score < 0.06);
  const distinct: Place[] = [];
  const seen = new Set<string>();
  for (const s of close) {
    const key = samePlaceKey(s.place.id);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(s.place);
  }
  if (distinct.length === 1) {
    const preferred = index.find((p) => p.id === samePlaceKey(distinct[0].id)) ?? distinct[0];
    return { kind: "found", place: preferred };
  }
  return { kind: "ambiguous", options: distinct.slice(0, 8) };
}

import fs from "node:fs";
import path from "node:path";
import { campusGraph } from "./graph";
import { buildings } from "./mapData";

export interface RoomUsage {
  id: string;
  name: string;
  uses: number;
  currentlyClaimed: boolean;
}

export type ManagedNameKind = "building" | "floor" | "room" | "area";

export interface ManagedNameItem {
  id: string;
  kind: ManagedNameKind;
  name: string;
  fallbackName: string;
  context: string;
  buildingId?: string;
  floor?: number;
  nodeId?: string;
}

const globalStore = globalThis as unknown as {
  atlasRoomNames?: Map<string, string>;
  atlasRoomUses?: Map<string, number>;
};

const roomNames =
  globalStore.atlasRoomNames ??
  (globalStore.atlasRoomNames = new Map<string, string>());
const roomUses =
  globalStore.atlasRoomUses ??
  (globalStore.atlasRoomUses = new Map<string, number>());

const adminDataFile = path.join(process.cwd(), "data", "room-admin.json");

try {
  const saved = JSON.parse(fs.readFileSync(adminDataFile, "utf8"));
  if (saved.names && typeof saved.names === "object" && !Array.isArray(saved.names)) {
    Object.entries(saved.names).forEach(([id, name]) => {
      if (typeof name === "string") roomNames.set(id, name);
    });
  }
  if (saved.uses && typeof saved.uses === "object" && !Array.isArray(saved.uses)) {
    Object.entries(saved.uses).forEach(([id, uses]) => {
      if (typeof uses === "number") roomUses.set(id, uses);
    });
  }
} catch {
  // The JSON data file is created on the first successful admin edit.
}

function saveAdminData(): void {
  fs.mkdirSync(path.dirname(adminDataFile), { recursive: true });
  const temporaryFile = `${adminDataFile}.tmp`;
  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(
      {
        names: Object.fromEntries(roomNames),
        uses: Object.fromEntries(roomUses),
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.renameSync(temporaryFile, adminDataFile);
}

export function floorNameKey(buildingId: string, floor: number): string {
  return `floor:${buildingId}:${floor}`;
}

export function buildingNameKey(buildingId: string): string {
  return `building:${buildingId}`;
}

export function getManagedName(id: string, fallback?: string): string {
  return roomNames.get(id) ?? fallback ?? id;
}

export function getRoomName(id: string, fallback?: string): string {
  return getManagedName(
    id,
    fallback ?? campusGraph.nodes.find((node) => node.id === id)?.name ?? id,
  );
}

export function getBuildingName(id: string, fallback?: string): string {
  const building = buildings.find((candidate) => candidate.id === id);
  return getManagedName(buildingNameKey(id), fallback ?? building?.name ?? id);
}

export function getFloorName(
  buildingId: string,
  floor: number,
  fallback?: string,
): string {
  const building = buildings.find((candidate) => candidate.id === buildingId);
  const plan = building?.floors.find((candidate) => candidate.floor === floor);
  return getManagedName(
    floorNameKey(buildingId, floor),
    fallback ?? plan?.name ?? `Floor ${floor}`,
  );
}

export function listRenamedRoomNames(): Record<string, string> {
  return Object.fromEntries(roomNames);
}

export function listManagedNameItems(): ManagedNameItem[] {
  const items = new Map<string, ManagedNameItem>();

  buildings.forEach((building) => {
    items.set(buildingNameKey(building.id), {
      id: buildingNameKey(building.id),
      kind: "building",
      name: getBuildingName(building.id, building.name),
      fallbackName: building.name,
      context: "Campus Overview",
      buildingId: building.id,
    });

    building.floors.forEach((floor) => {
      const id = floorNameKey(building.id, floor.floor);
      items.set(id, {
        id,
        kind: "floor",
        name: getFloorName(building.id, floor.floor, floor.name),
        fallbackName: floor.name,
        context: getBuildingName(building.id, building.name),
        buildingId: building.id,
        floor: floor.floor,
      });

      floor.rooms.forEach((room) => {
        const id =
          room.nodeId ??
          `room:${building.id}:${floor.floor}:${room.id}`;
        const fallbackName = room.label.replace(/\n/g, " ").trim();
        items.set(id, {
          id,
          kind: "room",
          name: getManagedName(id, fallbackName),
          fallbackName,
          context: `${getBuildingName(building.id, building.name)}, ${getFloorName(building.id, floor.floor, floor.name)}`,
          buildingId: building.id,
          floor: floor.floor,
          nodeId: room.nodeId,
        });
      });
    });
  });

  // Include campus-level map places and any graph location not represented by a
  // floor-plan polygon. Existing graph IDs stay the canonical identifiers.
  campusGraph.nodes
    .filter((node) => node.kind === "entrance" || node.kind === "gate")
    .forEach((node) => {
      if (items.has(node.id)) return;
      const buildingId =
        node.id.startsWith("NB-") ? "new" :
        node.id.startsWith("OB-") ? "old" :
        node.id.startsWith("CTMO-") ? "ctmo" :
        node.id.startsWith("HM-") ? "hm" :
        node.id.startsWith("CL-N-") ? "cl-n" :
        node.id.startsWith("CL-S-") ? "cl-s" :
        node.id.startsWith("GYM-") ? "gym" : undefined;
      const building = buildings.find((candidate) => candidate.id === buildingId);
      const context = building
        ? `${getBuildingName(building.id, building.name)}${node.floor ? `, ${getFloorName(building.id, node.floor)}` : ""}`
        : "Campus grounds";
      items.set(node.id, {
        id: node.id,
        kind: "area",
        name: getRoomName(node.id, node.name),
        fallbackName: node.name,
        context,
        buildingId,
        floor: node.floor,
        nodeId: node.id,
      });
    });

  const order: Record<ManagedNameKind, number> = {
    building: 0,
    floor: 1,
    room: 2,
    area: 3,
  };
  return [...items.values()].sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      a.context.localeCompare(b.context) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

export function renameManagedName(id: string, name: string): boolean {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) return false;
  const known = listManagedNameItems().some((item) => item.id === id);
  if (!known) return false;
  roomNames.set(id, cleanName);
  saveAdminData();
  return true;
}

// Backwards-compatible name for the original room-only admin endpoint.
export function renameRoom(id: string, name: string): boolean {
  return renameManagedName(id, name);
}

export function recordRoomUse(id: string): void {
  roomUses.set(id, (roomUses.get(id) ?? 0) + 1);
  saveAdminData();
}

export function listRoomUsage(
  claimedIds: ReadonlySet<string> = new Set(),
): RoomUsage[] {
  return campusGraph.nodes
    .filter((node) => node.claimable)
    .map((node) => ({
      id: node.id,
      name: getRoomName(node.id, node.name),
      uses: roomUses.get(node.id) ?? 0,
      currentlyClaimed: claimedIds.has(node.id),
    }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}

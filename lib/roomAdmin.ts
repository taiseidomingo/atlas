import fs from "node:fs";
import path from "node:path";
import { campusGraph } from "./graph";

export interface RoomUsage {
  id: string;
  name: string;
  uses: number;
  currentlyClaimed: boolean;
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
  if (saved.names && typeof saved.names === "object") {
    Object.entries(saved.names).forEach(([id, name]) => {
      if (typeof name === "string") roomNames.set(id, name);
    });
  }
  if (saved.uses && typeof saved.uses === "object") {
    Object.entries(saved.uses).forEach(([id, uses]) => {
      if (typeof uses === "number") roomUses.set(id, uses);
    });
  }
} catch {}

function saveAdminData(): void {
  fs.mkdirSync(path.dirname(adminDataFile), { recursive: true });
  fs.writeFileSync(
    adminDataFile,
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
}

export function getRoomName(id: string, fallback?: string): string {
  return roomNames.get(id) ?? fallback ?? campusGraph.nodes.find((n) => n.id === id)?.name ?? id;
}

export function listRenamedRoomNames(): Record<string, string> {
  return Object.fromEntries(roomNames);
}

export function renameRoom(id: string, name: string): boolean {
  const node = campusGraph.nodes.find((candidate) => candidate.id === id);
  if (!node || !name.trim()) return false;
  roomNames.set(id, name.trim());
  saveAdminData();
  return true;
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

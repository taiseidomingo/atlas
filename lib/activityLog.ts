import fs from "node:fs";
import path from "node:path";
import { campusGraph } from "./graph";
import { getBuildingName, getFloorName, getRoomName } from "./roomAdmin";
import { buildingById, buildingOfNode } from "./mapData";

export interface RoomActivity {
  id: string;
  professor: string;
  professorId: string;
  nodeId: string;
  roomName: string;
  floor: string;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  status: "active" | "released" | "incomplete";
}

export interface UsagePeriod {
  period: "day" | "week" | "month" | "custom";
  from: string;
  to: string;
}

interface ActivityStore {
  activities: RoomActivity[];
}

const dataFile = path.join(process.cwd(), "data", "room-activity.json");

const globalStore = globalThis as unknown as {
  atlasActivityStore?: ActivityStore;
};

function readStore(): ActivityStore {
  if (globalStore.atlasActivityStore) return globalStore.atlasActivityStore;
  let activities: RoomActivity[] = [];
  try {
    activities = JSON.parse(fs.readFileSync(dataFile, "utf8")).activities ?? [];
  } catch {}
  globalStore.atlasActivityStore = { activities };
  return globalStore.atlasActivityStore;
}

function writeStore(store: ActivityStore): void {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
}

const store = readStore();

export function startRoomActivity(
  nodeId: string,
  professor: string,
  professorId = professor.trim().toLowerCase(),
): RoomActivity {
  const node = campusGraph.nodes.find((candidate) => candidate.id === nodeId);
  const buildingId = buildingOfNode(nodeId);
  const building = buildingId ? buildingById[buildingId] : null;
  const floorPlan = building?.floors.find((floor) => floor.floor === node?.floor);
  const activity: RoomActivity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    professor,
    professorId,
    nodeId,
    roomName: getRoomName(nodeId, node?.name ?? nodeId),
    floor: building
      ? `${getBuildingName(building.id, building.name)}, ${getFloorName(building.id, node?.floor ?? 1, floorPlan?.name)}`
      : "Campus grounds",
    checkIn: new Date().toISOString(),
    checkOut: null,
    durationMinutes: null,
    status: "active",
  };
  store.activities.push(activity);
  writeStore(store);
  return activity;
}

export function finishRoomActivity(
  nodeId: string,
  professor: string,
  checkOut = new Date().toISOString(),
): RoomActivity | null {
  const activity = [...store.activities]
    .reverse()
    .find(
      (entry) =>
        entry.nodeId === nodeId &&
        entry.professor === professor &&
        (entry.status === "active" || entry.status === "incomplete"),
    );
  if (!activity) return null;
  activity.checkOut = checkOut;
  activity.status = "released";
  activity.durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(checkOut).getTime() - new Date(activity.checkIn).getTime()) /
        60000,
    ),
  );
  writeStore(store);
  return activity;
}

export function finishProfessorActivities(professor: string): void {
  const checkOut = new Date().toISOString();
  let changed = false;
  store.activities.forEach((activity) => {
    if (
      activity.professor === professor &&
      (activity.status === "active" || activity.status === "incomplete")
    ) {
      activity.checkOut = checkOut;
      activity.status = "released";
      activity.durationMinutes = Math.max(
        0,
        Math.round(
          (new Date(checkOut).getTime() -
            new Date(activity.checkIn).getTime()) /
            60000,
        ),
      );
      changed = true;
    }
  });
  if (changed) writeStore(store);
}

export function listActivities(): RoomActivity[] {
  return [...store.activities]
    .map((activity) => {
      const node = campusGraph.nodes.find((candidate) => candidate.id === activity.nodeId);
      const buildingId = buildingOfNode(activity.nodeId);
      const building = buildingId ? buildingById[buildingId] : null;
      const floorPlan = building?.floors.find((floor) => floor.floor === node?.floor);
      return {
        ...activity,
        roomName: getRoomName(activity.nodeId, node?.name ?? activity.roomName),
        floor: building && buildingId
          ? `${getBuildingName(buildingId, building.name)}, ${getFloorName(buildingId, node?.floor ?? 1, floorPlan?.name)}`
          : "Campus grounds",
      };
    })
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
}

export function filterActivities(
  activities: RoomActivity[],
  period: UsagePeriod,
): RoomActivity[] {
  const from = new Date(period.from);
  const to = new Date(period.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  const inclusiveEnd = new Date(to);
  inclusiveEnd.setHours(23, 59, 59, 999);
  return activities.filter((activity) => {
    const checkIn = new Date(activity.checkIn);
    return checkIn >= from && checkIn <= inclusiveEnd;
  });
}

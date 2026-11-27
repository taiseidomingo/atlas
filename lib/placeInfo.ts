import { campusGraph } from "./graph";
import { buildingById, buildingOfNode, campusShapes } from "./mapData";
import type { BuildingId } from "./mapData";
import { buildingDisplayName, displayName, floorDisplayName } from "./locationNames";

export interface PlaceInfo {
  id: string;
  name: string;
  type: string;
  place: string;
  description: string;
  photos: string[];
  buildingId?: BuildingId;
  floor?: number;
}




const PHOTOS: Record<string, string[]> = {};

const DESCRIPTIONS: Record<string, string> = {
  "Gate 1":
    "Main south entrance of the campus. Most visitors and students enter here.",
  "Gate 2":
    "North entrance of the campus, close to the HM building and the CTMO.",
  "CTMO building":
    "Campus offices building near the north side of the grounds.",
  "Maintenance room":
    "Maintenance and utilities room on the west side of the campus.",
  "Canteen area":
    "Food and drinks for students and staff, along the west path.",
  "Smart Room":
    "Technology-equipped room for presentations, trainings and meetings.",
  "Learning Room": "Learning space near Gate 1 for classes and group study.",
  "NB-1-REGISTRAR": "Enrollment records, transcripts and certifications.",
  "NB-1-CASHIER": "Tuition and fee payments.",
  "NB-1-GUIDANCE": "Counseling and student guidance services.",
  "NB-1-OSAS":
    "Office of Student Affairs and Services: student organizations, IDs and activities.",
  "NB-1-DEAN": "Office of the Dean.",
  "NB-1-MIS":
    "Management Information System office: school systems and accounts.",
};

function slug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getPlaceInfo(
  id: string,
  names: Record<string, string> = {},
): PlaceInfo | null {
  const node = campusGraph.nodes.find((n) => n.id === id);
  if (!node) return null;

  const photos = PHOTOS[id] ?? [`/places/${slug(id)}.jpg`];
  const b = buildingOfNode(id);

  if (b) {
    const building = buildingById[b];
    const plan = building.floors.find((f) => f.floor === node.floor);
    const room = plan?.rooms.find((r) => r.nodeId === id);
    const type = room?.type ?? "Room";
    const currentBuildingName = buildingDisplayName(names, b, building.name);
    const currentFloorName = floorDisplayName(
      names,
      b,
      node.floor ?? 1,
      plan?.name ?? `Floor ${node.floor}`,
    );
    const place = `${currentBuildingName}, ${currentFloorName}`;
    const name = displayName(names, id, room?.label ?? node.name);
    const description =
      DESCRIPTIONS[id] ??
      (room?.department
        ? `${type} of the ${room.department}, on the ${currentFloorName.toLowerCase()} of the ${currentBuildingName}.`
        : `${type} on the ${currentFloorName.toLowerCase()} of the ${currentBuildingName}.`);
    return {
      id,
      name,
      type,
      place,
      description,
      photos,
      buildingId: b,
      floor: node.floor,
    };
  }

  const shape = campusShapes.find((s) => s.nodeId === id);
  const description =
    id === "Gate 2"
      ? `North entrance of the campus, close to the ${buildingDisplayName(names, "hm", "HM building")} and ${buildingDisplayName(names, "ctmo", "CTMO")}.`
      : DESCRIPTIONS[id] ?? `${shape?.type ?? "Location"} on the campus grounds.`;
  return {
    id,
    name: displayName(names, id, node.name),
    type: shape?.type ?? "Location",
    place: "Campus grounds",
    description,
    photos,
  };
}

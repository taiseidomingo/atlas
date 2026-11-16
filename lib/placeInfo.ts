import { campusGraph } from "./graph";
import { buildingById, buildingOfNode, campusShapes } from "./mapData";
import type { BuildingId } from "./mapData";

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

// Photos: drop a file in /public/places named after the node id in lowercase,
// e.g. public/places/nb-1-registrar.jpg or public/places/gate-1.jpg.
// Or list exact paths here to use several pictures for one place.
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

export function getPlaceInfo(id: string): PlaceInfo | null {
  const node = campusGraph.nodes.find((n) => n.id === id);
  if (!node) return null;

  const photos = PHOTOS[id] ?? [`/places/${slug(id)}.jpg`];
  const b = buildingOfNode(id);

  if (b) {
    const building = buildingById[b];
    const plan = building.floors.find((f) => f.floor === node.floor);
    const room = plan?.rooms.find((r) => r.nodeId === id);
    const type = room?.type ?? "Room";
    const place = `${building.name}, ${plan?.name ?? `Floor ${node.floor}`}`;
    const name = (room?.label ?? node.name).replace(/\n/g, " ");
    const description =
      DESCRIPTIONS[id] ??
      (room?.department
        ? `${type} of the ${room.department}, on the ${plan?.name?.toLowerCase()} of the ${building.name}.`
        : `${type} on the ${plan?.name?.toLowerCase()} of the ${building.name}.`);
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
  return {
    id,
    name: node.name,
    type: shape?.type ?? "Location",
    place: "Campus grounds",
    description:
      DESCRIPTIONS[id] ?? `${shape?.type ?? "Location"} on the campus grounds.`,
    photos,
  };
}

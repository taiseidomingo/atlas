import type { GraphEdge, GraphNode, NodeId } from "./graph";

const INDOOR_METERS_PER_PIXEL = 0.04;
const FLOOR_CHANGE_METERS = 8;
const CORRIDOR_X = 450;
const DOOR_X = 674;

interface RoomSpec {
  code: string;
  name: string;
  y: number;
  claimable?: boolean;
  doorX?: number;
}

function upperFloor(
  floor: number,
  prefix: number,
  lastRoomName: string,
): RoomSpec[] {
  const classroom = (n: number, y: number): RoomSpec => ({
    code: `${prefix}0${n}`,
    name: `Room ${prefix}0${n} (New Building)`,
    y,
    claimable: true,
  });

  return [
    classroom(5, 208),
    classroom(4, 530),
    classroom(3, 814),
    classroom(2, 1112),
    classroom(1, 1416),
    {
      code: `DEPT${floor}`,
      name: `${lastRoomName} (New Building)`,
      y: 1734,
    },
  ];
}

const floor1: RoomSpec[] = [
  {
    code: "CR-N",
    name: "Comfort Room 1F north (New Building)",
    y: 101,
    doorX: 714,
  },
  {
    code: "DEAN",
    name: "Dean's Office (New Building)",
    y: 285,
    doorX: 660,
  },
  {
    code: "OSAS",
    name: "Office of Student Affairs and Services (New Building)",
    y: 469,
    doorX: 667,
  },
  {
    code: "GUIDANCE",
    name: "Guidance Office (New Building)",
    y: 616,
    doorX: 667,
  },
  {
    code: "PE",
    name: "Physical Education Department (New Building)",
    y: 745,
    doorX: 667,
  },
  {
    code: "CASHIER",
    name: "Cashier (New Building)",
    y: 885,
    doorX: 667,
  },
  {
    code: "MIS",
    name: "Management Information System (New Building)",
    y: 1032,
    doorX: 667,
  },
  {
    code: "REGISTRAR",
    name: "Registrar (New Building)",
    y: 1173,
    doorX: 667,
  },
  {
    code: "RESDEV",
    name: "Research and Development (New Building)",
    y: 1320,
    doorX: 667,
  },
  {
    code: "IDO",
    name: "IDO (New Building)",
    y: 1457,
    doorX: 667,
  },
  {
    code: "MGMT",
    name: "Department of Management (New Building)",
    y: 1647,
    doorX: 667,
  },
  {
    code: "CR-S",
    name: "Comfort Room 1F south (New Building)",
    y: 1821,
    doorX: 714,
  },
];

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

function find(id: NodeId): GraphNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`newBuilding: no node with id "${id}"`);
  return node;
}

function link(from: NodeId, to: NodeId): void {
  const a = find(from);
  const b = find(to);
  const meters = Math.hypot(a.x - b.x, a.y - b.y) * INDOOR_METERS_PER_PIXEL;
  edges.push({ from, to, weight: Math.round(meters * 10) / 10 });
}

function nearestCorridor(floor: number, y: number): NodeId {
  const candidates = nodes.filter(
    (n) => n.floor === floor && n.kind === "junction" && n.id.includes("-C"),
  );
  return candidates.reduce((best, n) =>
    Math.abs(n.y - y) < Math.abs(best.y - y) ? n : best,
  ).id;
}

function addFloor(
  floor: number,
  rooms: RoomSpec[],
  lift: { x: number; y: number },
): void {
  const corridorIds: NodeId[] = [];

  rooms.forEach((room, i) => {
    const corridorId = `NB-${floor}-C${i + 1}`;
    const roomId = `NB-${floor}-${room.code}`;

    nodes.push({
      id: corridorId,
      name: `New Building ${floor}F hallway ${i + 1}`,
      x: CORRIDOR_X,
      y: room.y,
      kind: "junction",
      floor,
      claimable: false,
    });
    nodes.push({
      id: roomId,
      name: room.name,
      x: room.doorX ?? DOOR_X,
      y: room.y,
      kind: "entrance",
      floor,
      claimable: room.claimable ?? false,
    });

    link(corridorId, roomId);
    corridorIds.push(corridorId);
  });

  for (let i = 0; i < corridorIds.length - 1; i++) {
    link(corridorIds[i], corridorIds[i + 1]);
  }

  const liftId = `NB-${floor}-LIFT`;
  nodes.push({
    id: liftId,
    name: `New Building elevator and stairs (${floor}F)`,
    x: lift.x,
    y: lift.y,
    kind: "junction",
    floor,
    claimable: false,
  });
  link(liftId, nearestCorridor(floor, lift.y));
}

addFloor(1, floor1, {
  x: 240,
  y: 953,
});
addFloor(2, upperFloor(2, 2, "Education Department"), {
  x: CORRIDOR_X,
  y: 1000,
});
addFloor(3, upperFloor(3, 3, "Office AD Department"), {
  x: CORRIDOR_X,
  y: 1000,
});
addFloor(4, upperFloor(4, 4, "DLM C"), {
  x: CORRIDOR_X,
  y: 1000,
});
addFloor(5, upperFloor(5, 5, "Social Department"), {
  x: CORRIDOR_X,
  y: 1000,
});

for (let floor = 1; floor < 5; floor++) {
  edges.push({
    from: `NB-${floor}-LIFT`,
    to: `NB-${floor + 1}-LIFT`,
    weight: FLOOR_CHANGE_METERS,
  });
}

nodes.push({
  id: "NB-1-ENTRANCE",
  name: "New Building entrance",
  x: CORRIDOR_X,
  y: 953,
  kind: "gate",
  floor: 1,
  claimable: false,
});
link("NB-1-ENTRANCE", nearestCorridor(1, 953));

export const newBuildingNodes: GraphNode[] = nodes;
export const newBuildingEdges: GraphEdge[] = edges;

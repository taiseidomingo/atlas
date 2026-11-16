import type { GraphEdge, GraphNode } from "./graph";

const M_PER_PX = 0.04;
const STAIRS_METERS = 8;

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];
const byId = new Map<string, GraphNode>();

function add(n: GraphNode) {
  nodes.push(n);
  byId.set(n.id, n);
}

function link(a: string, b: string) {
  const A = byId.get(a);
  const B = byId.get(b);
  if (!A || !B) throw new Error(`auxiliaryBuildings: unknown node ${a} / ${b}`);
  const m = Math.hypot(A.x - B.x, A.y - B.y) * M_PER_PX;
  edges.push({
    from: a,
    to: b,
    weight: Math.max(0.5, Math.round(m * 10) / 10),
  });
}

interface Spec {
  prefix: string;
  floor: number;
  corridorX: number; // walkable corridor line
  doorX: number; // where room doors sit
  rooms: { code: string; name: string; y: number }[];
  extra?: { code: string; y: number }[]; // extra points on the corridor
  stairs?: { x: number; y: number };
  entrance?: {
    x: number;
    y: number;
    via?: { x: number; y: number };
    spine: string; // corridor point the entrance joins
  };
}

// All coordinates are image pixels (768 x 1365), the same space as imageRoomRect.
function addFloor(s: Spec) {
  const id = (c: string) => `${s.prefix}-${s.floor}-${c}`;
  const spine: { code: string; y: number }[] = [
    ...s.rooms.map((r) => ({ code: `H-${r.code}`, y: r.y })),
    ...(s.extra ?? []),
  ];
  if (s.stairs) spine.push({ code: "ST", y: s.stairs.y });
  spine.sort((a, b) => a.y - b.y);

  spine.forEach((p) =>
    add({
      id: id(p.code),
      name: `${s.prefix} ${s.floor}F hallway ${p.code}`,
      x: s.corridorX,
      y: p.y,
      kind: "junction",
      floor: s.floor,
      claimable: false,
    }),
  );
  for (let i = 1; i < spine.length; i++)
    link(id(spine[i - 1].code), id(spine[i].code));

  s.rooms.forEach((r) => {
    add({
      id: id(r.code),
      name: r.name,
      x: s.doorX,
      y: r.y,
      kind: "entrance",
      floor: s.floor,
      claimable: true,
    });
    link(id(`H-${r.code}`), id(r.code));
  });

  if (s.stairs) {
    add({
      id: id("STAIRS"),
      name: `${s.prefix} stairs (${s.floor}F)`,
      x: s.stairs.x,
      y: s.stairs.y,
      kind: "junction",
      floor: s.floor,
      claimable: false,
    });
    link(id("STAIRS"), id("ST"));
    const below = `${s.prefix}-${s.floor - 1}-STAIRS`;
    if (byId.has(below))
      edges.push({ from: below, to: id("STAIRS"), weight: STAIRS_METERS });
  }

  if (s.entrance && s.floor === 1) {
    const eid = `${s.prefix}-ENTRANCE`;
    add({
      id: eid,
      name: `${s.prefix} entrance`,
      x: s.entrance.x,
      y: s.entrance.y,
      kind: "gate",
      floor: 1,
      claimable: false,
    });
    let from = eid;
    if (s.entrance.via) {
      const vid = `${s.prefix}-ENTRANCE-IN`;
      add({
        id: vid,
        name: `${s.prefix} entrance hall`,
        x: s.entrance.via.x,
        y: s.entrance.via.y,
        kind: "junction",
        floor: 1,
        claimable: false,
      });
      link(eid, vid);
      from = vid;
    }
    link(from, id(s.entrance.spine));
  }
}

// CTMO: full-width rooms, entrance on the RIGHT edge level with CTMO 3.
addFloor({
  prefix: "CTMO",
  floor: 1,
  corridorX: 590,
  doorX: 560,
  entrance: { x: 607, y: 674, spine: "H-3" },
  rooms: [
    { code: "1", name: "CTMO 1", y: 1058 },
    { code: "2", name: "CTMO 2", y: 866 },
    { code: "3", name: "CTMO 3", y: 674 },
    { code: "GAD", name: "GAD & Knowledge Management Center", y: 482 },
    {
      code: "RESEARCH",
      name: "Research Development & Extension Office",
      y: 290,
    },
  ],
});

// HM: 3 floors joined by stairs (top-right box), 2 rooms per floor.
[1, 2, 3].forEach((f) =>
  addFloor({
    prefix: "HM",
    floor: f,
    corridorX: 415,
    doorX: 395,
    stairs: { x: 507, y: 403 },
    entrance: { x: 415, y: 334, spine: "ST" },
    rooms: [
      { code: `${f}01`, name: `HM ${f}01`, y: 510 },
      { code: `${f}02`, name: `HM ${f}02`, y: 849 },
    ],
  }),
);

// CL 1-4 = SOUTH building (near Gate 1). Rooms on the right, corridor on the left.
addFloor({
  prefix: "CL-S",
  floor: 1,
  corridorX: 280,
  doorX: 385,
  extra: [{ code: "BASE", y: 1115 }],
  entrance: { x: 494, y: 1160, via: { x: 494, y: 1115 }, spine: "BASE" },
  rooms: [
    { code: "1", name: "CL 1", y: 961 },
    { code: "2", name: "CL 2", y: 742 },
    { code: "3", name: "CL 3", y: 522 },
    { code: "4", name: "CL 4", y: 303 },
  ],
});

// CL 5-8 = NORTH building (near Gate 2). Rooms on the left, corridor on the right.
addFloor({
  prefix: "CL-N",
  floor: 1,
  corridorX: 540,
  doorX: 424,
  extra: [{ code: "BASE", y: 1110 }],
  entrance: { x: 324, y: 1159, via: { x: 324, y: 1110 }, spine: "BASE" },
  rooms: [
    { code: "5", name: "CL 5", y: 953 },
    { code: "6", name: "CL 6", y: 734 },
    { code: "7", name: "CL 7", y: 514 },
    { code: "8", name: "CL 8", y: 295 },
  ],
});

export const auxiliaryBuildingNodes = nodes;
export const auxiliaryBuildingEdges = edges;

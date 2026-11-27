import dotsData from "./dots.json";

export type NodeId = string;

export interface GraphNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  kind: "junction" | "gate" | "entrance";
  claimable?: boolean;
  floor?: number;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  weight: number;
}

export interface CampusGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const METERS_PER_PIXEL = 0.05;

interface DotCoord {
  x: number;
  y: number;
}

const dotsMap = dotsData as Record<string, DotCoord[]>;

function buildCampusGraph(): CampusGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byId = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();

  function addNode(n: GraphNode) {
    if (byId.has(n.id)) return;
    nodes.push(n);
    byId.set(n.id, n);
  }

  function addEdge(from: string, to: string, weight?: number) {
    if (!byId.has(from) || !byId.has(to) || from === to) return;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const a = byId.get(from)!;
    const b = byId.get(to)!;
    const w =
      weight ??
      Math.max(
        1,
        Math.round(Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PIXEL * 10) /
          10,
      );
    edges.push({ from, to, weight: w });
  }

  function processMap(
    key: string,
    prefix: string,
    floor: number = 1,
    extraPairs: [number, number, number][] = [],
  ) {
    const dots = dotsMap[key] || [];
    dots.forEach((d, i) => {
      addNode({
        id: `${prefix}-DOT-${i}`,
        name: `${prefix} path dot ${i}`,
        x: d.x,
        y: d.y,
        kind: "junction",
        floor,
      });
    });

    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
        if (d <= 185) {
          addEdge(`${prefix}-DOT-${i}`, `${prefix}-DOT-${j}`);
        }
      }
    }

    extraPairs.forEach(([i, j, w]) => {
      addEdge(`${prefix}-DOT-${i}`, `${prefix}-DOT-${j}`, w);
    });
  }

  processMap("01", "CAMPUS", 1);
  processMap("02", "OB-1", 1, [[23, 62, 5.0]]);
  processMap("03", "OB-2", 2);
  processMap("04", "OB-3", 3, [
    [8, 18, 5.0],
    [9, 59, 5.0],
    [18, 19, 5.0],
    [59, 60, 5.0],

    // Missing links in the third-floor dashed corridor:
    // the two stair landing stubs and the east-side walkway branch.
    [0, 7, 17.3],
    [1, 8, 17.3],
    [12, 62, 47.4],
  ]);
  processMap("05", "CL-S-1", 1);
  processMap("06", "CL-N-1", 1);
  processMap("07", "CTMO-1", 1);
  processMap("08", "GYM-1", 1, [
    // Join the upper and lower parts of the gym perimeter walkway.
    [73, 86, 42.5],
    [72, 87, 47.3],

    // Join the four dashed room-entry branches to the lower corridor.
    [142, 219, 25.0],
    [143, 162, 19.6],
    [144, 169, 19.4],
    [145, 190, 23.0],

    // Join the walkable junction groups inside the open gym floor.
    [111, 75, 39.4],
    [58, 85, 24.0],
    [82, 77, 9.8],
  ]);
  processMap("09", "HM-1", 1);
  processMap("10", "HM-2", 2);
  processMap("11", "HM-3", 3);
  processMap("12", "NB-1", 1);
  processMap("13", "NB-2", 2);
  processMap("14", "NB-3", 3);
  processMap("15", "NB-4", 4);
  processMap("16", "NB-5", 5);

  function closestDot(prefix: string, x: number, y: number): GraphNode | null {
    let best: GraphNode | null = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      if (node.id.startsWith(`${prefix}-DOT-`)) {
        const dist = Math.hypot(node.x - x, node.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = node;
        }
      }
    }
    return best;
  }

  function linkToClosestDot(
    nodeId: string,
    dotPrefix: string,
    targetX: number,
    targetY: number,
    weight?: number,
  ) {
    const dot = closestDot(dotPrefix, targetX, targetY);
    const place = byId.get(nodeId);

    if (!dot || !place) {
      return;
    }

    const distanceToDoor = Math.hypot(place.x - targetX, place.y - targetY);

    const toMeters = (distancePx: number) =>
      Math.max(0.1, Math.round(distancePx * METERS_PER_PIXEL * 10) / 10);

    if (distanceToDoor < 1) {
      addEdge(nodeId, dot.id, weight);
      return;
    }

    const doorId = `${nodeId}-DOOR`;

    addNode({
      id: doorId,
      name: `${place.name} entrance`,
      x: targetX,
      y: targetY,
      kind: "junction",
      floor: place.floor,
    });

    const doorNode = byId.get(doorId);

    if (!doorNode) {
      return;
    }

    addEdge(nodeId, doorId, toMeters(distanceToDoor));

    const distanceToPath = Math.hypot(doorNode.x - dot.x, doorNode.y - dot.y);

    addEdge(doorId, dot.id, weight ?? toMeters(distanceToPath));
  }

  const campusPlaces: GraphNode[] = [
    { id: "Gate 1", name: "Gate 1", x: 6556, y: 2400, kind: "gate", floor: 1 },
    { id: "Gate 2", name: "Gate 2", x: 1236, y: 2400, kind: "gate", floor: 1 },
    {
      id: "Smart Room",
      name: "Smart Room",
      x: 5708,
      y: 1900,
      kind: "entrance",
      claimable: true,
      floor: 1,
    },
    {
      id: "Learning Room",
      name: "Learning Room",
      x: 6028,
      y: 3100,
      kind: "entrance",
      claimable: true,
      floor: 1,
    },
    {
      id: "Benches",
      name: "Benches",
      x: 1932,
      y: 2850,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Maintenance room",
      name: "Maintenance room",
      x: 2866,
      y: 3992,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Canteen area",
      name: "Canteen area",
      x: 5032,
      y: 3988,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Comfort room north",
      name: "Comfort room (North)",
      x: 1726,
      y: 3352,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Comfort room south",
      name: "Comfort room (South)",
      x: 3758,
      y: 4144,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Gymnasium",
      name: "Gymnasium",
      x: 4128,
      y: 1902,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "Stage",
      name: "Stage",
      x: 5278,
      y: 1902,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "CTMO building",
      name: "CTMO building",
      x: 2166,
      y: 2020,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "HM building",
      name: "HM building",
      x: 1870,
      y: 4090,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "CL North",
      name: "CL North",
      x: 2626,
      y: 3488,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "CL South",
      name: "CL South",
      x: 5544,
      y: 3494,
      kind: "entrance",
      floor: 1,
    },
    {
      id: "NB-1-ENTRANCE",
      name: "New Building Entrance",
      x: 3960,
      y: 1220,
      kind: "gate",
      floor: 1,
    },
    {
      id: "OB-1-ENTRANCE",
      name: "Old Building Entrance",
      x: 3950,
      y: 3728,
      kind: "gate",
      floor: 1,
    },
    {
      id: "CTMO-ENTRANCE",
      name: "CTMO Entrance",
      x: 2584,
      y: 2020,
      kind: "gate",
      floor: 1,
    },
    {
      id: "HM-ENTRANCE",
      name: "HM Entrance",
      x: 2120,
      y: 4090,
      kind: "gate",
      floor: 1,
    },
    {
      id: "CL-N-ENTRANCE",
      name: "CL North Entrance",
      x: 2868,
      y: 3488,
      kind: "gate",
      floor: 1,
    },
    {
      id: "CL-S-ENTRANCE",
      name: "CL South Entrance",
      x: 5300,
      y: 3494,
      kind: "gate",
      floor: 1,
    },
    {
      id: "GYM-ENTRANCE",
      name: "Gymnasium Stage Entrance",
      x: 5476,
      y: 1902,
      kind: "gate",
      floor: 1,
    },
  ];

  campusPlaces.forEach((p) => {
    addNode(p);
    linkToClosestDot(p.id, "CAMPUS", p.x, p.y);
  });

  addEdge("NB-1-ENTRANCE", "CAMPUS-DOT-1", 5.0);
  linkToClosestDot("NB-1-ENTRANCE", "NB-1", 3960, 2228, 5.0);

  linkToClosestDot("OB-1-ENTRANCE", "CAMPUS", 3950, 3728, 5.0);
  linkToClosestDot("OB-1-ENTRANCE", "OB-1", 3950, 3650, 5.0);

  linkToClosestDot("CTMO-ENTRANCE", "CAMPUS", 2584, 2020, 5.0);
  linkToClosestDot("CTMO-ENTRANCE", "CTMO-1", 1650, 3400, 5.0);

  linkToClosestDot("HM-ENTRANCE", "CAMPUS", 2120, 4090, 5.0);
  linkToClosestDot("HM-ENTRANCE", "HM-1", 4000, 2600, 5.0);

  linkToClosestDot("CL-N-ENTRANCE", "CAMPUS", 2868, 3488, 5.0);
  linkToClosestDot("CL-N-ENTRANCE", "CL-N-1", 7450, 2050, 5.0);

  linkToClosestDot("CL-S-ENTRANCE", "CAMPUS", 5300, 3494, 5.0);
  linkToClosestDot("CL-S-ENTRANCE", "CL-S-1", 7050, 2100, 5.0);

  linkToClosestDot("GYM-ENTRANCE", "CAMPUS", 5476, 1902, 5.0);
  linkToClosestDot("GYM-ENTRANCE", "GYM-1", 4125, 2750, 5.0);

  const ob1Rooms = [
    {
      id: "OB-1-HM",
      name: "HM LAB",
      x: 3974,
      y: 632,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3974,
      doorY: 1250,
    },
    {
      id: "OB-1-HM-STOCK",
      name: "Hospitality Management Stockroom",
      x: 2574,
      y: 644,
      floor: 1,
      kind: "entrance" as const,
      doorX: 2574,
      doorY: 1250,
    },
    {
      id: "OB-1-KITCHEN",
      name: "Old Kitchen",
      x: 5330,
      y: 644,
      floor: 1,
      kind: "entrance" as const,
      doorX: 5330,
      doorY: 1250,
    },
    {
      id: "OB-1-RM107",
      name: "RM 107",
      x: 1122,
      y: 1358,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1720,
      doorY: 1358,
    },
    {
      id: "OB-1-RM106",
      name: "RM 106",
      x: 1122,
      y: 1742,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1720,
      doorY: 1742,
    },
    {
      id: "OB-1-RM105",
      name: "RM 105",
      x: 1122,
      y: 2126,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1720,
      doorY: 2126,
    },
    {
      id: "OB-1-FACULTY",
      name: "Faculty",
      x: 1122,
      y: 2568,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1720,
      doorY: 2568,
    },
    {
      id: "OB-1-CR1",
      name: "CR (West Upper)",
      x: 776,
      y: 2938,
      floor: 1,
      kind: "entrance" as const,
      doorX: 1720,
      doorY: 2938,
    },
    {
      id: "OB-1-CR2",
      name: "CR (West Lower)",
      x: 1160,
      y: 2938,
      floor: 1,
      kind: "entrance" as const,
      doorX: 1720,
      doorY: 2938,
    },
    {
      id: "OB-1-CONFERENCE",
      name: "Conference Room",
      x: 1162,
      y: 3274,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1850,
      doorY: 3274,
    },
    {
      id: "OB-1-SUPPLY",
      name: "Supply Office",
      x: 1026,
      y: 3706,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1520,
      doorY: 3706,
    },
    {
      id: "OB-1-MULTIMEDIA",
      name: "Multimedia Room",
      x: 1026,
      y: 4138,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1520,
      doorY: 4138,
    },
    {
      id: "OB-1-RM116",
      name: "RM 116",
      x: 2378,
      y: 1520,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2280,
      doorY: 1900,
    },
    {
      id: "OB-1-RM117",
      name: "RM 117",
      x: 2770,
      y: 1520,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2680,
      doorY: 1900,
    },
    {
      id: "OB-1-RM113",
      name: "RM 113",
      x: 2378,
      y: 2344,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2280,
      doorY: 2724,
    },
    {
      id: "OB-1-RM112",
      name: "RM 112",
      x: 2770,
      y: 2344,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2680,
      doorY: 2724,
    },
    {
      id: "OB-1-RADIO",
      name: "Radio Room",
      x: 2574,
      y: 2864,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3000,
      doorY: 2800,
    },
    {
      id: "OB-1-RM118",
      name: "RM 118",
      x: 5134,
      y: 1520,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5040,
      doorY: 1900,
    },
    {
      id: "OB-1-RM119",
      name: "RM 119",
      x: 5526,
      y: 1520,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5430,
      doorY: 1900,
    },
    {
      id: "OB-1-RM114",
      name: "RM 114",
      x: 5134,
      y: 2344,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5040,
      doorY: 2724,
    },
    {
      id: "OB-1-RM115",
      name: "RM 115",
      x: 5526,
      y: 2344,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5430,
      doorY: 2724,
    },
    {
      id: "OB-1-TVROOM",
      name: "TV Room",
      x: 5330,
      y: 2864,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4850,
      doorY: 2800,
    },
    {
      id: "OB-1-SECURITY",
      name: "Civil Security Office",
      x: 2648,
      y: 3528,
      floor: 1,
      kind: "entrance" as const,
      doorX: 2500,
      doorY: 3274,
    },
    {
      id: "OB-1-DISCIPLINE",
      name: "Office of the Campus Discipline",
      x: 5224,
      y: 3528,
      floor: 1,
      kind: "entrance" as const,
      doorX: 5100,
      doorY: 3274,
    },
    {
      id: "OB-1-CHEMISTRY",
      name: "Chemistry Lab RM 120",
      x: 6970,
      y: 1437,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6200,
      doorY: 1416,
    },
    {
      id: "OB-1-HEALTH",
      name: "Health Science Lab RM 121",
      x: 6970,
      y: 1980,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6200,
      doorY: 1916,
    },
    {
      id: "OB-1-BIOLOGY",
      name: "Biology Lab RM 122",
      x: 6970,
      y: 2526,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6200,
      doorY: 2416,
    },
    {
      id: "OB-1-CR3",
      name: "CR (East)",
      x: 7208,
      y: 2919,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6200,
      doorY: 2790,
    },
    {
      id: "OB-1-ADMISSION",
      name: "Admission Office",
      x: 6360,
      y: 3325,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6000,
      doorY: 3168,
    },
    {
      id: "OB-1-HEALTH-SERVICES",
      name: "Health Services Unit",
      x: 7042,
      y: 3325,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6400,
      doorY: 3450,
    },
    {
      id: "OB-1-STUDENT-DEV",
      name: "Student Development Service Office",
      x: 6320,
      y: 4066,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6000,
      doorY: 3940,
    },
    {
      id: "OB-1-SOUND-STORAGE",
      name: "Sound System Storage",
      x: 6680,
      y: 4066,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6400,
      doorY: 3600,
    },
    {
      id: "OB-1-OSAS-ALUMNI",
      name: "OSAS & Alumni Assoc. Office",
      x: 7020,
      y: 4066,
      floor: 1,
      kind: "entrance" as const,
      doorX: 6700,
      doorY: 3600,
    },
    {
      id: "OB-1-STOCK",
      name: "Stock Room",
      x: 7338,
      y: 4066,
      floor: 1,
      kind: "entrance" as const,
      doorX: 7100,
      doorY: 3600,
    },
    {
      id: "OB-1-CURVE-STAIRS",
      name: "Curved Stairs to Floor 2.1",
      x: 2072,
      y: 3300,
      floor: 1,
      kind: "gate" as const,
      doorX: 2340,
      doorY: 3274,
    },
    {
      id: "OB-1-STAIRS-112",
      name: "Stairs beside RM 112 to Floor 2.2",
      x: 3066,
      y: 2497,
      floor: 1,
      kind: "gate" as const,
      doorX: 3200,
      doorY: 2400,
    },
    {
      id: "OB-1-STAIRS-114",
      name: "Stairs beside RM 114 to Floor 2.2",
      x: 4834,
      y: 2497,
      floor: 1,
      kind: "gate" as const,
      doorX: 4700,
      doorY: 2400,
    },
    {
      id: "OB-1-EXIT-CL-N",
      name: "Exit to CL 5-8",
      x: 1386,
      y: 973,
      floor: 1,
      kind: "gate" as const,
      doorX: 1151,
      doorY: 975,
    },
    {
      id: "OB-1-EXIT-CL-S",
      name: "Exit to CL 1-4",
      x: 6678,
      y: 973,
      floor: 1,
      kind: "gate" as const,
      doorX: 6200,
      doorY: 1100,
    },
  ];

  ob1Rooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "OB-1", r.doorX, r.doorY);
  });

  const ob2Rooms = [
    {
      id: "OB-2.1-CURVE-STAIRS",
      name: "Curved Stairs to 1st Floor",
      x: 2730,
      y: 1658,
      floor: 2,
      kind: "gate" as const,
      doorX: 2500,
      doorY: 2274,
    },
    {
      id: "OB-2.1-CSG",
      name: "CSG Office",
      x: 599,
      y: 2845,
      floor: 2,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1190,
      doorY: 2542,
    },
    {
      id: "OB-2.1-RM202",
      name: "RM 202",
      x: 1590,
      y: 3354,
      floor: 2,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1590,
      doorY: 2973,
    },
    {
      id: "OB-2.1-SUPPLY-STOCK",
      name: "Supply & Property Office",
      x: 2465,
      y: 3352,
      floor: 2,
      kind: "entrance" as const,
      doorX: 2464,
      doorY: 2973,
    },
    {
      id: "OB-2.1-FITTING",
      name: "Fitting Room",
      x: 3200,
      y: 3348,
      floor: 2,
      kind: "entrance" as const,
      doorX: 3284,
      doorY: 2925,
    },
    {
      id: "OB-2.1-LIBRARY",
      name: "Library",
      x: 5725,
      y: 3234,
      floor: 2,
      kind: "entrance" as const,
      doorX: 4791,
      doorY: 2675,
    },
    {
      id: "OB-2.1-DCS",
      name: "Department of Computer Studies",
      x: 6583,
      y: 1458,
      floor: 2,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6272,
      doorY: 2018,
    },
    {
      id: "OB-2.1-FACULTY-STORAGE",
      name: "Storage Room (For Faculty)",
      x: 7593,
      y: 2350,
      floor: 2,
      kind: "entrance" as const,
      doorX: 7128,
      doorY: 2546,
    },
  ];

  ob2Rooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "OB-2", r.doorX, r.doorY);
  });

  const ob3Rooms = [
    {
      id: "OB-2.2-STAIRS-L",
      name: "Stairs (Left) to 1st Floor",
      x: 2340,
      y: 2436,
      floor: 3,
      kind: "gate" as const,
      doorX: 2339,
      doorY: 2438,
    },
    {
      id: "OB-2.2-STAIRS-R",
      name: "Stairs (Right) to 1st Floor",
      x: 5660,
      y: 2436,
      floor: 3,
      kind: "gate" as const,
      doorX: 5660,
      doorY: 2438,
    },
    {
      id: "OB-2.2-FUNCTION",
      name: "Function Hall",
      x: 4000,
      y: 2100,
      floor: 3,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3195,
      doorY: 2820,
    },
    {
      id: "OB-2.2-RM212",
      name: "RM 212",
      x: 1728,
      y: 2250,
      floor: 3,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2180,
      doorY: 2928,
    },
    {
      id: "OB-2.2-RM213",
      name: "RM 213",
      x: 6276,
      y: 2250,
      floor: 3,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5778,
      doorY: 2928,
    },
    {
      id: "OB-2.2-TO-CL-S",
      name: "Walkway to CL 1-4",
      x: 740,
      y: 1970,
      floor: 3,
      kind: "gate" as const,
      doorX: 742,
      doorY: 2588,
    },
    {
      id: "OB-2.2-TO-CL-N",
      name: "Walkway to CL 5-8",
      x: 7260,
      y: 1970,
      floor: 3,
      kind: "gate" as const,
      doorX: 7257,
      doorY: 2583,
    },
  ];

  ob3Rooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "OB-3", r.doorX, r.doorY);
  });

  const clSRooms = [
    {
      id: "CL-S-1",
      name: "CL 1",
      x: 6036,
      y: 1950,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6100,
      doorY: 3000,
    },
    {
      id: "CL-S-2",
      name: "CL 2",
      x: 4576,
      y: 1950,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4600,
      doorY: 3000,
    },
    {
      id: "CL-S-3",
      name: "CL 3",
      x: 3116,
      y: 1950,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3100,
      doorY: 3000,
    },
    {
      id: "CL-S-4",
      name: "CL 4",
      x: 1656,
      y: 1950,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1650,
      doorY: 3000,
    },
    {
      id: "CL-S-STAIRS",
      name: "CL 1-4 Stairs",
      x: 7425,
      y: 2475,
      floor: 1,
      kind: "gate" as const,
      doorX: 7050,
      doorY: 2100,
    },
  ];

  clSRooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "CL-S-1", r.doorX, r.doorY);
  });

  const clNRooms = [
    {
      id: "CL-N-5",
      name: "CL 5",
      x: 6036,
      y: 2000,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6000,
      doorY: 700,
    },
    {
      id: "CL-N-6",
      name: "CL 6",
      x: 4576,
      y: 2000,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4420,
      doorY: 700,
    },
    {
      id: "CL-N-7",
      name: "CL 7",
      x: 3116,
      y: 2000,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2950,
      doorY: 700,
    },
    {
      id: "CL-N-8",
      name: "CL 8",
      x: 1656,
      y: 2000,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1500,
      doorY: 700,
    },
    {
      id: "CL-N-STAIRS",
      name: "CL 5-8 Stairs",
      x: 7425,
      y: 2525,
      floor: 1,
      kind: "gate" as const,
      doorX: 7450,
      doorY: 2050,
    },
  ];

  clNRooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "CL-N-1", r.doorX, r.doorY);
  });

  const ctmoRooms = [
    {
      id: "CTMO-1",
      name: "CTMO 1",
      x: 2140,
      y: 2050,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2140,
      doorY: 3400,
    },
    {
      id: "CTMO-2",
      name: "CTMO 2",
      x: 3120,
      y: 2050,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3120,
      doorY: 3400,
    },
    {
      id: "CTMO-3",
      name: "CTMO 3",
      x: 4100,
      y: 2050,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4100,
      doorY: 3400,
    },
    {
      id: "CTMO-GAD",
      name: "GAD & Knowledge Management Center Office",
      x: 5080,
      y: 2050,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5080,
      doorY: 3400,
    },
    {
      id: "CTMO-RESEARCH",
      name: "Research Development and Extension Office",
      x: 6060,
      y: 2050,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6060,
      doorY: 3400,
    },
  ];

  ctmoRooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "CTMO-1", r.doorX, r.doorY);
  });

  const gymRooms = [
    {
      id: "GYM-STAGE",
      name: "Stage Floor",
      x: 4125,
      y: 1580,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4125,
      doorY: 2750,
    },
    {
      id: "GYM-CR",
      name: "CR (Stage)",
      x: 2500,
      y: 3100,
      floor: 1,
      kind: "entrance" as const,
      doorX: 2500,
      doorY: 2750,
    },
    {
      id: "GYM-DMST",
      name: "Department of Military Service and Tactics",
      x: 3550,
      y: 3100,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3550,
      doorY: 2750,
    },
    {
      id: "GYM-OSD",
      name: "Office of the Sports and Development",
      x: 4600,
      y: 3100,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4600,
      doorY: 2750,
    },
    {
      id: "GYM-FITTING",
      name: "Fitting Room",
      x: 5650,
      y: 3100,
      floor: 1,
      kind: "entrance" as const,
      doorX: 5650,
      doorY: 2750,
    },
  ];

  gymRooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "GYM-1", r.doorX, r.doorY);
  });

  for (let f = 1; f <= 3; f++) {
    const rooms = [
      {
        id: `HM-${f}-${f}02`,
        name: `HM ${f}02`,
        x: 2725,
        y: 1250,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 2725,
        doorY: 2600,
      },
      {
        id: `HM-${f}-${f}01`,
        name: `HM ${f}01`,
        x: 5475,
        y: 1250,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 5475,
        doorY: 2600,
      },
      {
        id: `HM-${f}-STAIRS`,
        name: `HM Stairs (${f}F)`,
        x: 5950,
        y: 3200,
        floor: f,
        kind: "gate" as const,
        doorX: 5150,
        doorY: 2700,
      },
    ];
    rooms.forEach((r) => {
      addNode(r);
      linkToClosestDot(r.id, `HM-${f}`, r.doorX, r.doorY);
    });
  }

  const nb1Rooms = [
    {
      id: "NB-1-CR-S",
      name: "CR (South)",
      x: 327,
      y: 3208,
      floor: 1,
      kind: "entrance" as const,
      doorX: 290,
      doorY: 2850,
    },
    {
      id: "NB-1-MGMT",
      name: "Department of Management",
      x: 1079,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1079,
      doorY: 2500,
    },
    {
      id: "NB-1-IDO",
      name: "IDO",
      x: 1888,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 1888,
      doorY: 2500,
    },
    {
      id: "NB-1-RESDEV",
      name: "Research and Development",
      x: 2500,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 2500,
      doorY: 2500,
    },
    {
      id: "NB-1-REGISTRAR",
      name: "Registrar",
      x: 3112,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3112,
      doorY: 2500,
    },
    {
      id: "NB-1-MIS",
      name: "MIS",
      x: 3720,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 3720,
      doorY: 2500,
    },
    {
      id: "NB-1-CASHIER",
      name: "Cashier",
      x: 4332,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4332,
      doorY: 2500,
    },
    {
      id: "NB-1-PE",
      name: "PE Dept",
      x: 4941,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 4941,
      doorY: 2500,
    },
    {
      id: "NB-1-GUIDANCE",
      name: "Guidance",
      x: 5553,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 5553,
      doorY: 2500,
    },
    {
      id: "NB-1-OSAS",
      name: "OSAS",
      x: 6165,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6165,
      doorY: 2500,
    },
    {
      id: "NB-1-DEAN",
      name: "Dean's Office",
      x: 6967,
      y: 3020,
      floor: 1,
      kind: "entrance" as const,
      claimable: true,
      doorX: 6967,
      doorY: 2500,
    },
    {
      id: "NB-1-CR-N",
      name: "CR (North)",
      x: 7717,
      y: 3208,
      floor: 1,
      kind: "entrance" as const,
      doorX: 7718,
      doorY: 2858,
    },
    {
      id: "NB-1-ELEVATOR",
      name: "Elevator",
      x: 4248,
      y: 1222,
      floor: 1,
      kind: "gate" as const,
      doorX: 4250,
      doorY: 1700,
    },
    {
      id: "NB-1-STAIRS-L",
      name: "Stairs (Left)",
      x: 2500,
      y: 1312,
      floor: 1,
      kind: "gate" as const,
      doorX: 2445,
      doorY: 1900,
    },
    {
      id: "NB-1-STAIRS-R",
      name: "Stairs (Right)",
      x: 6008,
      y: 1312,
      floor: 1,
      kind: "gate" as const,
      doorX: 6010,
      doorY: 1900,
    },
  ];

  nb1Rooms.forEach((r) => {
    addNode(r);
    linkToClosestDot(r.id, "NB-1", r.doorX, r.doorY);
  });

  const upperDepts: Record<number, string> = {
    2: "Education Department",
    3: "Office AD Department",
    4: "DLMC",
    5: "Social Department",
  };

  for (let f = 2; f <= 5; f++) {
    const deptName = upperDepts[f];
    const rooms = [
      {
        id: `NB-${f}-DEPT`,
        name: deptName,
        x: 714,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 540,
        doorY: 2145,
      },
      {
        id: `NB-${f}-${f}01`,
        name: `Room ${f}01`,
        x: 2032,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 2060,
        doorY: 2145,
      },
      {
        id: `NB-${f}-${f}02`,
        name: `Room ${f}02`,
        x: 3343,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 3350,
        doorY: 2145,
      },
      {
        id: `NB-${f}-${f}03`,
        name: `Room ${f}03`,
        x: 4652,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 4600,
        doorY: 2145,
      },
      {
        id: `NB-${f}-${f}04`,
        name: `Room ${f}04`,
        x: 5963,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 5960,
        doorY: 2145,
      },
      {
        id: `NB-${f}-${f}05`,
        name: `Room ${f}05`,
        x: 7284,
        y: 2755,
        floor: f,
        kind: "entrance" as const,
        claimable: true,
        doorX: 7370,
        doorY: 2145,
      },
      {
        id: `NB-${f}-ELEVATOR`,
        name: `Elevator (${f}F)`,
        x: 4043,
        y: 854,
        floor: f,
        kind: "gate" as const,
        doorX: 4050,
        doorY: 1500,
      },
      {
        id: `NB-${f}-STAIRS-L`,
        name: `Stairs Left (${f}F)`,
        x: 2293,
        y: 945,
        floor: f,
        kind: "gate" as const,
        doorX: 2293,
        doorY: 1600,
      },
      {
        id: `NB-${f}-STAIRS-R`,
        name: `Stairs Right (${f}F)`,
        x: 5802,
        y: 945,
        floor: f,
        kind: "gate" as const,
        doorX: 5830,
        doorY: 1600,
      },
    ];
    rooms.forEach((r) => {
      addNode(r);
      linkToClosestDot(r.id, `NB-${f}`, r.doorX, r.doorY);
    });
  }

  const ob1Curve = closestDot("OB-1", 2340, 3274);
  const ob2Curve = closestDot("OB-2", 2500, 2274);
  if (ob1Curve && ob2Curve) addEdge(ob1Curve.id, ob2Curve.id, 8.0);

  const ob1Stairs112 = closestDot("OB-1", 3200, 2400);
  const ob3StairsL = closestDot("OB-3", 2339, 2438);
  if (ob1Stairs112 && ob3StairsL) addEdge(ob1Stairs112.id, ob3StairsL.id, 8.0);

  const ob1Stairs114 = closestDot("OB-1", 4700, 2400);
  const ob3StairsR = closestDot("OB-3", 5660, 2438);
  if (ob1Stairs114 && ob3StairsR) addEdge(ob1Stairs114.id, ob3StairsR.id, 8.0);

  const ob1ExitCLN = closestDot("OB-1", 1151, 975);
  const clNStairs = closestDot("CL-N-1", 7450, 2050);
  if (ob1ExitCLN && clNStairs) addEdge(ob1ExitCLN.id, clNStairs.id, 5.0);

  const ob1ExitCLS = closestDot("OB-1", 6200, 1100);
  const clSStairs = closestDot("CL-S-1", 7050, 2100);
  if (ob1ExitCLS && clSStairs) addEdge(ob1ExitCLS.id, clSStairs.id, 5.0);

  const ob3WalkwayS = closestDot("OB-3", 742, 2588);
  if (ob3WalkwayS && clSStairs) addEdge(ob3WalkwayS.id, clSStairs.id, 5.0);

  const ob3WalkwayN = closestDot("OB-3", 7257, 2583);
  if (ob3WalkwayN && clNStairs) addEdge(ob3WalkwayN.id, clNStairs.id, 5.0);

  const hm1Stairs = closestDot("HM-1", 5150, 2700);
  const hm2Stairs = closestDot("HM-2", 5150, 2700);
  const hm3Stairs = closestDot("HM-3", 5150, 2700);
  if (hm1Stairs && hm2Stairs) addEdge(hm1Stairs.id, hm2Stairs.id, 8.0);
  if (hm2Stairs && hm3Stairs) addEdge(hm2Stairs.id, hm3Stairs.id, 8.0);

  for (let f = 1; f < 5; f++) {
    const liftBelow = closestDot(`NB-${f}`, 3900, 900);
    const liftAbove = closestDot(`NB-${f + 1}`, 3900, 900);
    if (liftBelow && liftAbove) addEdge(liftBelow.id, liftAbove.id, 8.0);

    const stLBelow = closestDot(`NB-${f}`, 2600, 900);
    const stLAbove = closestDot(`NB-${f + 1}`, 2600, 900);
    if (stLBelow && stLAbove) addEdge(stLBelow.id, stLAbove.id, 8.0);

    const stRBelow = closestDot(`NB-${f}`, 5600, 900);
    const stRAbove = closestDot(`NB-${f + 1}`, 5600, 900);
    if (stRBelow && stRAbove) addEdge(stRBelow.id, stRAbove.id, 8.0);
  }

  return { nodes, edges };
}

export const campusGraph: CampusGraph = buildCampusGraph();

export type BuildingId =
  | "new"
  | "old"
  | "ctmo"
  | "hm"
  | "cl-n"
  | "cl-s"
  | "gym";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanRoom extends Rect {
  id: string;
  label: string;
  type: string;
  department?: string;
  nodeId?: string;
  placeholder?: boolean;
  openBuildingId?: BuildingId;
  openFloor?: number;
}

export interface FloorPlan {
  floor: number;
  name: string;
  bounds: Rect;
  open: Rect[];
  rooms: PlanRoom[];
  note?: string;
}

export interface Building {
  id: BuildingId;
  name: string;
  rect: Rect;
  door: { x: number; y: number };
  entranceId: string;
  floors: FloorPlan[];
}

export interface CampusShape extends Rect {
  id: string;
  label: string;
  tone: "dark" | "mid" | "soft";
  type: string;
  nodeId?: string;
  vertical?: boolean;
  fontSize?: number;
  buildingId?: BuildingId;
}

export const CAMPUS_VIEWBOX = { w: 8000, h: 4500 };
export const PLAN_HEIGHT = 4500;

export function planPoint(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

export function planRect(r: Rect): Rect {
  return r;
}

export function planViewBox(bounds: Rect, margin = 40): Rect {
  return {
    x: 0,
    y: 0,
    w: 8000,
    h: 4500,
  };
}

export function buildingOfNode(nodeId: string): BuildingId | null {
  if (nodeId.startsWith("NB-")) return "new";
  if (nodeId.startsWith("OB-")) return "old";
  if (nodeId.startsWith("CTMO-")) return "ctmo";
  if (nodeId.startsWith("HM-")) return "hm";
  if (nodeId.startsWith("CL-N-")) return "cl-n";
  if (nodeId.startsWith("CL-S-")) return "cl-s";
  if (nodeId.startsWith("GYM-")) return "gym";
  return null;
}

function room(
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  type: string,
  nodeId?: string,
  department?: string,
): PlanRoom {
  return { id, label, x, y, w, h, type, nodeId, department };
}

const oldFloor1: FloorPlan = {
  floor: 1,
  name: "1st Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("hm-lab", "HM LAB", 3176, 120, 1596, 1024, "Laboratory", "OB-1-HM"),
    room(
      "hm-stock",
      "HM Stockroom",
      2188,
      120,
      772,
      1048,
      "Storage",
      "OB-1-HM-STOCK",
    ),
    room(
      "kitchen",
      "Old Kitchen",
      4944,
      120,
      772,
      1048,
      "Laboratory",
      "OB-1-KITCHEN",
    ),
    room("rm-107", "RM 107", 616, 1176, 1012, 364, "Classroom", "OB-1-RM107"),
    room("rm-106", "RM 106", 616, 1560, 1012, 364, "Classroom", "OB-1-RM106"),
    room("rm-105", "RM 105", 616, 1944, 1012, 364, "Classroom", "OB-1-RM105"),
    room(
      "faculty",
      "Faculty",
      616,
      2328,
      1012,
      480,
      "Faculty Room",
      "OB-1-FACULTY",
    ),
    room("cr-1", "CR", 616, 2828, 320, 220, "Comfort Room", "OB-1-CR1"),
    room("cr-2", "CR", 960, 2828, 400, 220, "Comfort Room", "OB-1-CR2"),
    room(
      "conference",
      "Conference Room",
      616,
      3068,
      1092,
      412,
      "Conference Room",
      "OB-1-CONFERENCE",
    ),
    room(
      "supply",
      "Supply Office",
      616,
      3500,
      820,
      412,
      "Office",
      "OB-1-SUPPLY",
    ),
    room(
      "multimedia",
      "Multimedia Room",
      616,
      3932,
      820,
      412,
      "Multimedia Room",
      "OB-1-MULTIMEDIA",
    ),
    room("rm-116", "RM 116", 2188, 1200, 380, 640, "Classroom", "OB-1-RM116"),
    room("rm-117", "RM 117", 2580, 1200, 380, 640, "Classroom", "OB-1-RM117"),
    room("rm-113", "RM 113", 2188, 2024, 380, 640, "Classroom", "OB-1-RM113"),
    room("rm-112", "RM 112", 2580, 2024, 380, 640, "Classroom", "OB-1-RM112"),
    room(
      "radio",
      "Radio Room",
      2188,
      2684,
      772,
      360,
      "Radio Room",
      "OB-1-RADIO",
    ),
    room("rm-118", "RM 118", 4944, 1200, 380, 640, "Classroom", "OB-1-RM118"),
    room("rm-119", "RM 119", 5336, 1200, 380, 640, "Classroom", "OB-1-RM119"),
    room("rm-114", "RM 114", 4944, 2024, 380, 640, "Classroom", "OB-1-RM114"),
    room("rm-115", "RM 115", 5336, 2024, 380, 640, "Classroom", "OB-1-RM115"),
    room("tv", "TV Room", 4944, 2684, 772, 360, "TV Room", "OB-1-TVROOM"),
    room(
      "security",
      "Civil Security Office",
      2404,
      3376,
      488,
      304,
      "Office",
      "OB-1-SECURITY",
    ),
    room(
      "discipline",
      "Campus Discipline",
      4980,
      3376,
      488,
      304,
      "Office",
      "OB-1-DISCIPLINE",
    ),
    room(
      "chemistry",
      "Chemistry Lab RM 120",
      6464,
      1168,
      1012,
      538,
      "Laboratory",
      "OB-1-CHEMISTRY",
    ),
    room(
      "health",
      "Health Science Lab RM 121",
      6464,
      1711,
      1012,
      538,
      "Laboratory",
      "OB-1-HEALTH",
    ),
    room(
      "biology",
      "Biology Lab RM 122",
      6464,
      2257,
      1012,
      538,
      "Laboratory",
      "OB-1-BIOLOGY",
    ),
    room("cr-3", "CR", 6940, 2801, 536, 236, "Comfort Room", "OB-1-CR3"),
    room(
      "admission",
      "Admission Office",
      6149,
      3056,
      444,
      537,
      "Office",
      "OB-1-ADMISSION",
    ),
    room(
      "health-services",
      "Health Services Unit",
      6615,
      3056,
      868,
      537,
      "Clinic",
      "OB-1-HEALTH-SERVICES",
    ),
    room(
      "student-dev",
      "Student Development",
      6143,
      3751,
      370,
      631,
      "Office",
      "OB-1-STUDENT-DEV",
    ),
    room(
      "sound-storage",
      "Sound System Storage",
      6531,
      3751,
      342,
      631,
      "Storage",
      "OB-1-SOUND-STORAGE",
    ),
    room(
      "osas-alumni",
      "OSAS & Alumni",
      6885,
      3751,
      342,
      631,
      "Office",
      "OB-1-OSAS-ALUMNI",
    ),
    room("stock", "Stock Room", 7239, 3751, 248, 631, "Storage", "OB-1-STOCK"),
    {
      ...room(
        "curve-stairs",
        "Curved Stairs to Floor 2.1",
        1904,
        3132,
        336,
        336,
        "Stairs",
        "OB-1-CURVE-STAIRS",
      ),
      openBuildingId: "old",
      openFloor: 2,
    },
    {
      ...room(
        "stairs-112",
        "Stairs to Floor 2.2",
        2972,
        2345,
        188,
        304,
        "Stairs",
        "OB-1-STAIRS-112",
      ),
      openBuildingId: "old",
      openFloor: 3,
    },
    {
      ...room(
        "stairs-114",
        "Stairs to Floor 2.2",
        4740,
        2345,
        188,
        304,
        "Stairs",
        "OB-1-STAIRS-114",
      ),
      openBuildingId: "old",
      openFloor: 3,
    },
    {
      ...room(
        "exit-cl-n",
        "Exit to CL 5-8",
        1172,
        838,
        428,
        270,
        "Exit",
        "OB-1-EXIT-CL-N",
      ),
      openBuildingId: "cl-n",
    },
    {
      ...room(
        "exit-cl-s",
        "Exit to CL 1-4",
        6464,
        838,
        428,
        270,
        "Exit",
        "OB-1-EXIT-CL-S",
      ),
      openBuildingId: "cl-s",
    },
  ],
};

const oldFloor2_1: FloorPlan = {
  floor: 2,
  name: "Floor 2.1",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room(
      "curve-stairs-down",
      "Curved Stairs to 1st Floor",
      2236,
      1165,
      988,
      987,
      "Stairs",
      "OB-2.1-CURVE-STAIRS",
    ),
    room("csg", "CSG Office", 127, 2022, 944, 1646, "Office", "OB-2.1-CSG"),
    room("rm-202", "RM 202", 1096, 3059, 988, 590, "Classroom", "OB-2.1-RM202"),
    room(
      "supply-stock",
      "Supply & Property Office",
      2109,
      3056,
      711,
      593,
      "Storage",
      "OB-2.1-SUPPLY-STOCK",
    ),
    room(
      "fitting",
      "Fitting Room",
      2845,
      3053,
      711,
      590,
      "Storage",
      "OB-2.1-FITTING",
    ),
    room(
      "library",
      "Library",
      3581,
      2817,
      4289,
      835,
      "Library",
      "OB-2.1-LIBRARY",
    ),
    room(
      "dcs",
      "Dept. of Computer Studies",
      5295,
      1040,
      2575,
      836,
      "Department Office",
      "OB-2.1-DCS",
    ),
    room(
      "faculty-storage",
      "Storage Room (For Faculty)",
      7317,
      1916,
      553,
      867,
      "Storage",
      "OB-2.1-FACULTY-STORAGE",
    ),
  ],
};

const oldFloor2_2: FloorPlan = {
  floor: 3,
  name: "Floor 2.2",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room(
      "stairs-l-down",
      "Stairs to 1st Floor",
      2160,
      2144,
      360,
      584,
      "Stairs",
      "OB-2.2-STAIRS-L",
    ),
    room(
      "stairs-r-down",
      "Stairs to 1st Floor",
      5480,
      2144,
      360,
      584,
      "Stairs",
      "OB-2.2-STAIRS-R",
    ),
    room(
      "function",
      "Function Hall",
      2584,
      1440,
      2836,
      1320,
      "Function Hall",
      "OB-2.2-FUNCTION",
    ),
    room(
      "rm-212",
      "RM 212",
      1356,
      1440,
      744,
      1620,
      "Classroom",
      "OB-2.2-RM212",
    ),
    room(
      "rm-213",
      "RM 213",
      5904,
      1440,
      744,
      1620,
      "Classroom",
      "OB-2.2-RM213",
    ),
    {
      ...room(
        "to-cl-s",
        "CL Building RM 1-4",
        208,
        1440,
        1064,
        1060,
        "Walkway",
        "OB-2.2-TO-CL-S",
      ),
      openBuildingId: "cl-s",
    },
    {
      ...room(
        "to-cl-n",
        "CL Building RM 5-8",
        6728,
        1440,
        1064,
        1060,
        "Walkway",
        "OB-2.2-TO-CL-N",
      ),
      openBuildingId: "cl-n",
    },
  ],
};

const nbFloor1: FloorPlan = {
  floor: 1,
  name: "1st Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("cr-s", "CR (South)", 78, 2960, 497, 497, "Comfort Room", "NB-1-CR-S"),
    room(
      "mgmt",
      "Dept. of Management",
      590,
      2584,
      978,
      873,
      "Office",
      "NB-1-MGMT",
    ),
    room("ido", "IDO", 1590, 2584, 596, 873, "Office", "NB-1-IDO"),
    room("resdev", "Res/Dev", 2202, 2584, 596, 873, "Office", "NB-1-RESDEV"),
    room(
      "registrar",
      "Registrar",
      2814,
      2584,
      596,
      873,
      "Office",
      "NB-1-REGISTRAR",
    ),
    room("mis", "MIS", 3422, 2584, 597, 873, "Office", "NB-1-MIS"),
    room("cashier", "Cashier", 4034, 2584, 596, 873, "Office", "NB-1-CASHIER"),
    room("pe", "PE Dept", 4643, 2584, 596, 873, "Office", "NB-1-PE"),
    room(
      "guidance",
      "Guidance",
      5255,
      2584,
      596,
      873,
      "Office",
      "NB-1-GUIDANCE",
    ),
    room("osas", "OSAS", 5867, 2584, 596, 873, "Office", "NB-1-OSAS"),
    room("dean", "Dean's Office", 6478, 2584, 978, 873, "Office", "NB-1-DEAN"),
    room(
      "cr-n",
      "CR (North)",
      7469,
      2960,
      497,
      497,
      "Comfort Room",
      "NB-1-CR-N",
    ),
    room(
      "elevator",
      "Elevator",
      3761,
      900,
      978,
      643,
      "Elevator",
      "NB-1-ELEVATOR",
    ),
    room(
      "stairs-l",
      "Stairs (Left)",
      2245,
      900,
      509,
      824,
      "Stairs",
      "NB-1-STAIRS-L",
    ),
    room(
      "stairs-r",
      "Stairs (Right)",
      5752,
      900,
      512,
      824,
      "Stairs",
      "NB-1-STAIRS-R",
    ),
  ],
};

function newUpperFloorPlan(
  floor: number,
  deptLabel: string,
  deptName: string,
): FloorPlan {
  const ordinal = [
    "",
    "1st Floor",
    "2nd Floor",
    "3rd Floor",
    "4th Floor",
    "5th Floor",
  ][floor];
  const X = [59, 1388, 2702, 4009, 5317, 6627];
  const W = [1311, 1289, 1282, 1286, 1292, 1314];
  const rooms: PlanRoom[] = [
    room(
      "dept-" + floor,
      deptLabel,
      X[0],
      2249,
      W[0],
      1012,
      "Department Office",
      "NB-" + floor + "-DEPT",
      deptName,
    ),
    ...[1, 2, 3, 4, 5].map((n) =>
      room(
        "room-" + floor + "0" + n,
        "Room " + floor + "0" + n,
        X[n],
        2249,
        W[n],
        1012,
        "Classroom",
        "NB-" + floor + "-" + floor + "0" + n,
      ),
    ),
    room(
      "elevator-" + floor,
      "Elevator",
      3556,
      534,
      975,
      640,
      "Elevator",
      "NB-" + floor + "-ELEVATOR",
    ),
    room(
      "stairs-l-" + floor,
      "Stairs (Left)",
      2037,
      534,
      513,
      823,
      "Stairs",
      "NB-" + floor + "-STAIRS-L",
    ),
    room(
      "stairs-r-" + floor,
      "Stairs (Right)",
      5546,
      534,
      513,
      823,
      "Stairs",
      "NB-" + floor + "-STAIRS-R",
    ),
  ];
  return {
    floor,
    name: ordinal,
    bounds: { x: 0, y: 0, w: 8000, h: 4500 },
    open: [],
    rooms,
  };
}

const clSFloor: FloorPlan = {
  floor: 1,
  name: "1st Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("cl-1", "CL 1", 5336, 1200, 1400, 1500, "Classroom", "CL-S-1"),
    room("cl-2", "CL 2", 3876, 1200, 1400, 1500, "Classroom", "CL-S-2"),
    room("cl-3", "CL 3", 2416, 1200, 1400, 1500, "Classroom", "CL-S-3"),
    room("cl-4", "CL 4", 956, 1200, 1400, 1500, "Classroom", "CL-S-4"),
    room("stairs", "Stairs", 7200, 2100, 450, 750, "Stairs", "CL-S-STAIRS"),
  ],
};

const clNFloor: FloorPlan = {
  floor: 1,
  name: "1st Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("cl-5", "CL 5", 5336, 1250, 1400, 1500, "Classroom", "CL-N-5"),
    room("cl-6", "CL 6", 3876, 1250, 1400, 1500, "Classroom", "CL-N-6"),
    room("cl-7", "CL 7", 2416, 1250, 1400, 1500, "Classroom", "CL-N-7"),
    room("cl-8", "CL 8", 956, 1250, 1400, 1500, "Classroom", "CL-N-8"),
    room("stairs", "Stairs", 7200, 2150, 450, 750, "Stairs", "CL-N-STAIRS"),
  ],
};

const ctmoFloor: FloorPlan = {
  floor: 1,
  name: "1st Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("ctmo-1", "CTMO 1", 1650, 900, 980, 2300, "Office", "CTMO-1"),
    room("ctmo-2", "CTMO 2", 2630, 900, 980, 2300, "Office", "CTMO-2"),
    room("ctmo-3", "CTMO 3", 3610, 900, 980, 2300, "Office", "CTMO-3"),
    room(
      "ctmo-gad",
      "GAD & Knowledge Management",
      4590,
      900,
      980,
      2300,
      "Office",
      "CTMO-GAD",
    ),
    room(
      "ctmo-res",
      "Research Dev & Extension",
      5570,
      900,
      980,
      2300,
      "Office",
      "CTMO-RESEARCH",
    ),
  ],
};

function hmFloorPlan(floor: number): FloorPlan {
  const ordinal = ["", "1st Floor", "2nd Floor", "3rd Floor"][floor];
  return {
    floor,
    name: ordinal,
    bounds: { x: 0, y: 0, w: 8000, h: 4500 },
    open: [],
    rooms: [
      room(
        "hm-" + floor + "02",
        "HM " + floor + "02",
        1400,
        300,
        2650,
        1900,
        "Classroom",
        "HM-" + floor + "-" + floor + "02",
      ),
      room(
        "hm-" + floor + "01",
        "HM " + floor + "01",
        4150,
        300,
        2650,
        1900,
        "Classroom",
        "HM-" + floor + "-" + floor + "01",
      ),
      room(
        "stairs-" + floor,
        "Stairs",
        5150,
        2700,
        1600,
        1000,
        "Stairs",
        "HM-" + floor + "-STAIRS",
      ),
    ],
  };
}

const gymFloor: FloorPlan = {
  floor: 1,
  name: "Stage Floor",
  bounds: { x: 0, y: 0, w: 8000, h: 4500 },
  open: [],
  rooms: [
    room("stage", "Stage Floor", 2000, 880, 4250, 1400, "Stage", "GYM-STAGE"),
    room("cr", "CR", 2000, 2750, 1000, 700, "Comfort Room", "GYM-CR"),
    room(
      "dmst",
      "Dept of Military Service & Tactics",
      3050,
      2750,
      1000,
      700,
      "Office",
      "GYM-DMST",
    ),
    room(
      "osd",
      "Office of Sports Development",
      4100,
      2750,
      1000,
      700,
      "Office",
      "GYM-OSD",
    ),
    room(
      "fitting",
      "Fitting Room",
      5150,
      2750,
      1000,
      700,
      "Storage",
      "GYM-FITTING",
    ),
  ],
};

export const buildings: Building[] = [
  {
    id: "old",
    name: "Old Building",
    rect: { x: 2380, y: 2508, w: 3412, h: 1224 },
    door: { x: 3950, y: 3728 },
    entranceId: "OB-1-ENTRANCE",
    floors: [oldFloor1, oldFloor2_1, oldFloor2_2],
  },
  {
    id: "new",
    name: "New Building",
    rect: { x: 1784, y: 96, w: 4352, h: 1124 },
    door: { x: 3960, y: 1220 },
    entranceId: "NB-1-ENTRANCE",
    floors: [
      nbFloor1,
      newUpperFloorPlan(2, "Educ Department", "Education Department"),
      newUpperFloorPlan(3, "Office AD Dept", "Office AD Department"),
      newUpperFloorPlan(4, "DLMC", "DLMC"),
      newUpperFloorPlan(5, "Social Dept", "Social Department"),
    ],
  },
  {
    id: "ctmo",
    name: "CTMO",
    rect: { x: 1748, y: 1740, w: 836, h: 560 },
    door: { x: 2584, y: 2020 },
    entranceId: "CTMO-ENTRANCE",
    floors: [ctmoFloor],
  },
  {
    id: "hm",
    name: "HM Building",
    rect: { x: 1620, y: 3872, w: 500, h: 436 },
    door: { x: 2120, y: 4090 },
    entranceId: "HM-ENTRANCE",
    floors: [hmFloorPlan(1), hmFloorPlan(2), hmFloorPlan(3)],
  },
  {
    id: "cl-n",
    name: "CL Building (CL 5-8)",
    rect: { x: 2384, y: 3244, w: 484, h: 488 },
    door: { x: 2868, y: 3488 },
    entranceId: "CL-N-ENTRANCE",
    floors: [clNFloor],
  },
  {
    id: "cl-s",
    name: "CL Building (CL 1-4)",
    rect: { x: 5300, y: 3248, w: 488, h: 492 },
    door: { x: 5300, y: 3494 },
    entranceId: "CL-S-ENTRANCE",
    floors: [clSFloor],
  },
  {
    id: "gym",
    name: "Gymnasium",
    rect: { x: 2780, y: 1452, w: 2696, h: 900 },
    door: { x: 5476, y: 1902 },
    entranceId: "GYM-ENTRANCE",
    floors: [gymFloor],
  },
];

export const buildingById = Object.fromEntries(
  buildings.map((building) => [building.id, building]),
) as Record<BuildingId, Building>;

export const campusShapes: CampusShape[] = [
  {
    id: "gate1",
    label: "Gate 1",
    x: 6556,
    y: 952,
    w: 236,
    h: 2456,
    tone: "mid",
    type: "Campus gate",
    nodeId: "Gate 1",
    vertical: true,
  },
  {
    id: "gate2",
    label: "Gate 2",
    x: 1236,
    y: 964,
    w: 236,
    h: 2456,
    tone: "mid",
    type: "Campus gate",
    nodeId: "Gate 2",
    vertical: true,
  },
  {
    id: "cl-n-campus",
    label: "CL 5-8",
    x: 2384,
    y: 3244,
    w: 484,
    h: 488,
    tone: "dark",
    type: "CL classrooms",
    buildingId: "cl-n",
  },
  {
    id: "cl-s-campus",
    label: "CL 1-4",
    x: 5300,
    y: 3248,
    w: 488,
    h: 492,
    tone: "dark",
    type: "CL classrooms",
    buildingId: "cl-s",
  },
  {
    id: "hm",
    label: "HM Bldg.",
    x: 1620,
    y: 3872,
    w: 500,
    h: 436,
    tone: "dark",
    type: "Building",
    buildingId: "hm",
  },
  {
    id: "cr-north",
    label: "CR",
    x: 1604,
    y: 3352,
    w: 244,
    h: 284,
    tone: "soft",
    type: "Comfort room",
    nodeId: "Comfort room north",
  },
  {
    id: "benches",
    label: "Benches",
    x: 1932,
    y: 2524,
    w: 352,
    h: 656,
    tone: "soft",
    type: "Seating area",
    nodeId: "Benches",
  },
  {
    id: "ctmo",
    label: "CTMO",
    x: 1748,
    y: 1740,
    w: 836,
    h: 560,
    tone: "soft",
    type: "Building",
    nodeId: "CTMO building",
    buildingId: "ctmo",
  },
  {
    id: "gym",
    label: "Gymnasium",
    x: 2780,
    y: 1452,
    w: 2696,
    h: 900,
    tone: "mid",
    type: "Gymnasium",
    nodeId: "Gymnasium",
  },
  {
    id: "gym-stage",
    label: "Stage",
    x: 5080,
    y: 1600,
    w: 400,
    h: 550,
    tone: "soft",
    type: "Stage",
    buildingId: "gym",
  },
  {
    id: "smart",
    label: "Smart Room",
    x: 5708,
    y: 1440,
    w: 576,
    h: 908,
    tone: "soft",
    type: "Smart room",
    nodeId: "Smart Room",
  },
  {
    id: "learning",
    label: "Learning Room",
    x: 6028,
    y: 2520,
    w: 456,
    h: 1220,
    tone: "soft",
    type: "Learning room",
    nodeId: "Learning Room",
    vertical: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    x: 2404,
    y: 3992,
    w: 924,
    h: 488,
    tone: "soft",
    type: "Maintenance room",
    nodeId: "Maintenance room",
  },
  {
    id: "cr-south",
    label: "CR",
    x: 3456,
    y: 4144,
    w: 604,
    h: 324,
    tone: "soft",
    type: "Comfort room",
    nodeId: "Comfort room south",
  },
  {
    id: "canteen",
    label: "Canteen",
    x: 4252,
    y: 3988,
    w: 1560,
    h: 480,
    tone: "soft",
    type: "Canteen",
    nodeId: "Canteen area",
  },
];

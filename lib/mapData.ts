export type BuildingId = "new" | "old" | "ctmo" | "hm" | "cl-n" | "cl-s";

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

export const CAMPUS_VIEWBOX = { w: 462, h: 822 };

export const PLAN_HEIGHT = 2000;

export function planPoint(x: number, y: number): { x: number; y: number } {
  return { x: PLAN_HEIGHT - y, y: x };
}

export function planRect(r: Rect): Rect {
  return { x: PLAN_HEIGHT - (r.y + r.h), y: r.x, w: r.h, h: r.w };
}

export function planViewBox(bounds: Rect, margin = 40): Rect {
  const r = planRect(bounds);
  return {
    x: r.x - margin,
    y: r.y - margin,
    w: r.w + margin * 2,
    h: r.h + margin * 2,
  };
}

export function buildingOfNode(nodeId: string): BuildingId | null {
  if (nodeId.startsWith("NB-")) return "new";
  if (nodeId.startsWith("OB-")) return "old";
  if (nodeId.startsWith("CTMO-")) return "ctmo";
  if (nodeId.startsWith("HM-")) return "hm";
  if (nodeId.startsWith("CL-N-")) return "cl-n";
  if (nodeId.startsWith("CL-S-")) return "cl-s";
  return null;
}

const FLOOR_NAMES = [
  "",
  "1st Floor",
  "2nd Floor",
  "3rd Floor",
  "4th Floor",
  "5th Floor",
];

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

const newFloor1: FloorPlan = {
  floor: 1,
  name: FLOOR_NAMES[1],
  bounds: { x: 150, y: 30, w: 670, h: 1940 },
  open: [{ x: 320, y: 38, w: 485, h: 1924 }],
  rooms: [
    room("elevator", "Elevator", 165, 830, 155, 245, "Elevator"),
    room("cr-n", "CR", 680, 42, 120, 118, "Comfort room", "NB-1-CR-N"),
    room(
      "dean",
      "Dean's\nOffice",
      585,
      167,
      215,
      238,
      "Office",
      "NB-1-DEAN",
      "Dean's Office",
    ),
    room(
      "osas",
      "OSAS",
      585,
      411,
      215,
      142,
      "Office",
      "NB-1-OSAS",
      "Office of Student Affairs and Services",
    ),
    room(
      "guidance",
      "Guidance",
      585,
      558,
      215,
      144,
      "Office",
      "NB-1-GUIDANCE",
      "Guidance Office",
    ),
    room(
      "pe",
      "PE Dept.",
      585,
      708,
      215,
      142,
      "Department office",
      "NB-1-PE",
      "Physical Education Department",
    ),
    room(
      "cashier",
      "Cashier",
      585,
      855,
      215,
      143,
      "Office",
      "NB-1-CASHIER",
      "Cashier",
    ),
    room(
      "mis",
      "MIS",
      585,
      1003,
      215,
      142,
      "Office",
      "NB-1-MIS",
      "Management Information System",
    ),
    room(
      "registrar",
      "Registrar",
      585,
      1150,
      215,
      143,
      "Office",
      "NB-1-REGISTRAR",
      "Registrar",
    ),
    room(
      "resdev",
      "Res / Dev",
      585,
      1298,
      215,
      143,
      "Office",
      "NB-1-RESDEV",
      "Research and Development",
    ),
    room("ido", "IDO", 585, 1446, 215, 142, "Office", "NB-1-IDO", "IDO"),
    room(
      "mgmt",
      "Dept. of\nManagement",
      585,
      1593,
      215,
      240,
      "Department office",
      "NB-1-MGMT",
      "Department of Management",
    ),
    room("cr-s", "CR", 682, 1838, 118, 120, "Comfort room", "NB-1-CR-S"),
  ],
};

function newUpperFloor(
  floor: number,
  deptLabel: string,
  deptName: string,
): FloorPlan {
  const spans: [number, number, number][] = [
    [5, 42, 328],
    [4, 375, 311],
    [3, 691, 319],
    [2, 1015, 303],
    [1, 1323, 319],
  ];
  return {
    floor,
    name: FLOOR_NAMES[floor],
    bounds: { x: 340, y: 30, w: 510, h: 1940 },
    open: [{ x: 355, y: 38, w: 230, h: 1924 }],
    rooms: [
      ...spans.map(([n, y, h]) =>
        room(
          `room-${floor}0${n}`,
          `Room ${floor}0${n}`,
          585,
          y,
          248,
          h,
          "Classroom",
          `NB-${floor}-${floor}0${n}`,
        ),
      ),
      room(
        `dept-${floor}`,
        deptLabel,
        585,
        1647,
        248,
        311,
        "Department office",
        `NB-${floor}-DEPT${floor}`,
        deptName,
      ),
    ],
  };
}

const oldFloor1: FloorPlan = {
  floor: 1,
  name: FLOOR_NAMES[1],
  bounds: { x: 90, y: 850, w: 1040, h: 600 },
  open: [{ x: 110, y: 870, w: 1000, h: 560 }],
  note: "Old Building first floor",
  rooms: [
    room("hm-lab", "HM\nLAB", 119, 907, 220, 145, "Laboratory", "OB-1-HM"),
    room(
      "stock-a",
      "Stock\nRoom",
      222,
      1108,
      92,
      82,
      "Storage",
      "OB-1-STOCK-A",
    ),
    room(
      "stock-b",
      "Stock\nRoom",
      119,
      1064,
      92,
      82,
      "Storage",
      "OB-1-STOCK-B",
    ),
    room("rm-107", "RM 107", 560, 1155, 76, 158, "Classroom", "OB-1-CLASS-A"),
    room("rm-106", "RM 106", 480, 1155, 76, 158, "Classroom", "OB-1-CLASS-B"),
    room("rm-105", "RM 105", 390, 1155, 86, 158, "Classroom", "OB-1-CLASS-C"),
    room("rm-104", "RM 104", 300, 1155, 86, 158, "Classroom", "OB-1-CLASS-D"),
    room("rm-103", "RM 103", 210, 1155, 86, 158, "Classroom", "OB-1-CLASS-E"),
    room(
      "faculty-1f",
      "Faculty",
      624,
      1352,
      145,
      105,
      "Faculty room",
      "OB-1-FACULTY-1F",
    ),
    room(
      "conference",
      "Conference\nRoom",
      838,
      1328,
      115,
      150,
      "Conference room",
      "OB-1-CONFERENCE",
    ),
    room(
      "supply",
      "Supply\nOffice",
      928,
      1359,
      75,
      120,
      "Office",
      "OB-1-SUPPLY",
    ),
    room(
      "multimedia",
      "Multimedia\nRoom",
      1005,
      1328,
      75,
      150,
      "Room",
      "OB-1-MULTIMEDIA",
    ),
    room("rm-119", "RM 119", 363, 965, 110, 82, "Classroom", "OB-1-RM119"),
    room("rm-118", "RM 118", 363, 1055, 110, 82, "Classroom", "OB-1-RM118"),
    room("rm-115", "RM 115", 560, 965, 110, 82, "Classroom", "OB-1-RM115"),
    room("rm-114", "RM 114", 560, 1055, 110, 82, "Classroom", "OB-1-RM114"),
    room("radio", "Radio\nRoom", 700, 965, 105, 172, "Room", "OB-1-RADIO"),
    room("rm-117", "RM 117", 560, 1155, 110, 82, "Classroom", "OB-1-RM117"),
    room("rm-116", "RM 116", 560, 1245, 110, 82, "Classroom", "OB-1-RM116"),
    room("rm-112", "RM 112", 700, 1155, 110, 82, "Classroom", "OB-1-RM112"),
    room("rm-113", "RM 113", 700, 1245, 110, 82, "Classroom", "OB-1-RM113"),
    room(
      "chemistry",
      "Chemistry Lab\nRM 120",
      220,
      907,
      150,
      145,
      "Laboratory",
      "OB-1-CHEMISTRY",
    ),
    room(
      "health",
      "Health Science Lab\nRM 121",
      375,
      907,
      150,
      145,
      "Laboratory",
      "OB-1-HEALTH",
    ),
    room(
      "biology",
      "Biology Lab\nRM 122",
      530,
      907,
      150,
      145,
      "Laboratory",
      "OB-1-BIOLOGY",
    ),
    room("clinic", "Clinic", 690, 907, 105, 145, "Clinic", "OB-1-CLINIC"),
    room(
      "student-gov",
      "Student Government\nOffice",
      900,
      907,
      150,
      145,
      "Office",
      "OB-1-STUDENT-GOV",
    ),
    // Rooms drawn on the floor-plan image. Their real boxes come from
    // imageRoomRect() in CampusMap.tsx; the numbers here are placeholders.
    room(
      "stock-c",
      "Stock\nRoom",
      131,
      729,
      52,
      114,
      "Storage",
      "OB-1-STOCK-C",
    ),
    room(
      "stock-d",
      "Stock\nRoom",
      130,
      459,
      51,
      111,
      "Storage",
      "OB-1-STOCK-D",
    ),
    room(
      "stock-e",
      "Stock\nRoom",
      633,
      333,
      102,
      52,
      "Storage",
      "OB-1-STOCK-E",
    ),
    room(
      "stock-f",
      "Stock\nRoom",
      633,
      276,
      102,
      55,
      "Storage",
      "OB-1-STOCK-F",
    ),
    room("tv", "TV\nRoom", 440, 459, 53, 114, "Room", "OB-1-TVROOM"),
    room("cr-a", "CR", 495, 971, 59, 47, "Comfort room", "OB-1-CR-A"),
    room("cr-b", "CR", 519, 909, 36, 59, "Comfort room", "OB-1-CR-B"),
    room("cr-c", "CR", 491, 280, 59, 62, "Comfort room", "OB-1-CR-C"),
    room("ms", "M/S", 555, 390, 73, 58, "Room", "OB-1-MS"),
    room("ocd", "OCD", 620, 495, 31, 39, "Office", "OB-1-OCD"),
    room("security", "Security", 620, 765, 31, 42, "Office", "OB-1-SECURITY"),
  ],
};

const oldFloor2: FloorPlan = {
  floor: 2,
  name: FLOOR_NAMES[2],
  bounds: { x: 20, y: 465, w: 1090, h: 1105 },
  open: [{ x: 65, y: 475, w: 1030, h: 1085 }],
  rooms: [
    {
      ...room(
        "cl-n",
        "CL Building\nCL 5-8",
        68,
        478,
        214,
        162,
        "Classroom",
        "OB-2-CL-N",
      ),
      openBuildingId: "cl-n",
    },
    {
      ...room(
        "cl-s",
        "CL Building\nCL 1-4",
        68,
        1393,
        214,
        160,
        "Classroom",
        "OB-2-CL-S",
      ),
      openBuildingId: "cl-s",
    },
    room(
      "function-ext",
      "",
      32,
      905,
      46,
      210,
      "Function hall",
      "OB-2-FUNCTION",
    ),
    room(
      "function",
      "Function Hall",
      78,
      822,
      582,
      388,
      "Function hall",
      "OB-2-FUNCTION",
    ),
    room(
      "faculty",
      "Faculty",
      745,
      478,
      123,
      319,
      "Faculty room",
      "OB-2-FACULTY",
    ),
    room("library", "Library", 967, 478, 123, 599, "Library", "OB-2-LIBRARY"),
    room("stock1", "Stock\nRoom", 1005, 1082, 85, 85, "Storage", "OB-2-STOCK1"),
    room("stock2", "Stock\nRoom", 1005, 1172, 85, 85, "Storage", "OB-2-STOCK2"),
    room(
      "classroom",
      "Classroom",
      1005,
      1262,
      85,
      145,
      "Classroom",
      "OB-2-CLASSROOM",
    ),
    room(
      "org",
      "Org Office",
      843,
      1412,
      247,
      140,
      "Office",
      "OB-2-ORG",
      "Organization Office",
    ),
  ],
};

function auxiliaryFloor(
  floor: number,
  prefix: string,
  rooms: { code: string; label: string; department?: string }[],
  layout: { x: number; w: number } = { x: 270, w: 430 },
): FloorPlan {
  return {
    floor,
    name: FLOOR_NAMES[floor],
    bounds: { x: 200, y: 120, w: 600, h: 1500 },
    open: [{ x: 220, y: 140, w: 560, h: 1460 }],
    rooms: rooms.map((item, index) =>
      room(
        `${floor}-${item.code}`,
        item.label,
        layout.x,
        160 + index * 190,
        layout.w,
        175,
        "Room",
        `${prefix}-${floor}-${item.code}`,
        item.department,
      ),
    ),
  };
}

const ctmoFloors: FloorPlan[] = [
  auxiliaryFloor(
    1,
    "CTMO",
    [
      { code: "1", label: "CTMO 1" },
      { code: "2", label: "CTMO 2" },
      { code: "3", label: "CTMO 3" },
      { code: "GAD", label: "GAD & Knowledge\nManagement Center" },
      { code: "RESEARCH", label: "Research Development &\nExtension Office" },
    ],
    { x: 160, w: 445 },
  ),
];

const hmFloors: FloorPlan[] = [
  auxiliaryFloor(1, "HM", [
    { code: "101", label: "HM 101" },
    { code: "102", label: "HM 102" },
  ]),
  auxiliaryFloor(2, "HM", [
    { code: "201", label: "HM 201" },
    { code: "202", label: "HM 202" },
  ]),
  auxiliaryFloor(3, "HM", [
    { code: "301", label: "HM 301" },
    { code: "302", label: "HM 302" },
  ]),
];

// CL 5-8 is the north building (near Gate 2).
const clNorthFloors: FloorPlan[] = [
  auxiliaryFloor(
    1,
    "CL-N",
    [5, 6, 7, 8].map((n) => ({ code: `${n}`, label: `CL ${n}` })),
  ),
];

// CL 1-4 is the south building (near Gate 1).
const clSouthFloors: FloorPlan[] = [
  auxiliaryFloor(
    1,
    "CL-S",
    [1, 2, 3, 4].map((n) => ({ code: `${n}`, label: `CL ${n}` })),
  ),
];

export const buildings: Building[] = [
  {
    id: "old",
    name: "Old Building",
    rect: { x: 132, y: 260, w: 80, h: 360 },
    door: { x: 212, y: 450 },
    entranceId: "OB-1-ENTRANCE",
    floors: [oldFloor1, oldFloor2],
  },
  {
    id: "new",
    name: "New Building",
    rect: { x: 355, y: 197, w: 107, h: 460 },
    door: { x: 355, y: 525 },
    entranceId: "NB-1-ENTRANCE",
    floors: [
      newFloor1,
      newUpperFloor(2, "Education\nDepartment", "Education Department"),
      newUpperFloor(3, "Office AD\nDepartment", "Office AD Department"),
      newUpperFloor(4, "DLM C", "DLM C"),
      newUpperFloor(5, "Social\nDepartment", "Social Department"),
    ],
  },
  {
    id: "ctmo",
    name: "CTMO",
    rect: { x: 234, y: 194, w: 59, h: 88 },
    door: { x: 263, y: 194 },
    entranceId: "CTMO-ENTRANCE",
    floors: ctmoFloors,
  },
  {
    id: "hm",
    name: "HM Building",
    rect: { x: 48, y: 196, w: 45, h: 52 },
    door: { x: 70, y: 196 },
    entranceId: "HM-ENTRANCE",
    floors: hmFloors,
  },
  {
    id: "cl-n",
    name: "CL Building (CL 5-8)",
    rect: { x: 68, y: 478, w: 214, h: 162 },
    door: { x: 175, y: 478 },
    entranceId: "CL-N-ENTRANCE",
    floors: clNorthFloors,
  },
  {
    id: "cl-s",
    name: "CL Building (CL 1-4)",
    rect: { x: 68, y: 1393, w: 214, h: 160 },
    door: { x: 175, y: 1393 },
    entranceId: "CL-S-ENTRANCE",
    floors: clSouthFloors,
  },
];

export const buildingById = Object.fromEntries(
  buildings.map((building) => [building.id, building]),
) as Record<BuildingId, Building>;

export const campusShapes: CampusShape[] = [
  {
    id: "gate2",
    label: "Gate 2",
    x: 115,
    y: 140,
    w: 260,
    h: 25,
    tone: "mid",
    type: "Campus gate",
    nodeId: "Gate 2",
  },
  {
    id: "gate1",
    label: "Gate 1",
    x: 117,
    y: 694,
    w: 259,
    h: 24,
    tone: "mid",
    type: "Campus gate",
    nodeId: "Gate 1",
  },
  {
    id: "cl-n-campus",
    label: "CL",
    x: 80,
    y: 260,
    w: 52,
    h: 92,
    tone: "dark",
    type: "CL classrooms",
    buildingId: "cl-n",
  },
  {
    id: "cl-s-campus",
    label: "CL",
    x: 80,
    y: 560,
    w: 52,
    h: 60,
    tone: "dark",
    type: "CL classrooms",
    buildingId: "cl-s",
  },
  {
    id: "hm",
    label: "HM Bldg.",
    x: 48,
    y: 196,
    w: 45,
    h: 52,
    tone: "dark",
    type: "Building",
    fontSize: 8,
    buildingId: "hm",
  },
  {
    id: "cr",
    label: "CR",
    x: 105,
    y: 210,
    w: 30,
    h: 23,
    tone: "soft",
    type: "Comfort room",
    nodeId: "Comfort room",
    fontSize: 9,
  },
  {
    id: "benches",
    label: "Benches",
    x: 142,
    y: 197,
    w: 83,
    h: 37,
    tone: "soft",
    type: "Seating area",
    nodeId: "Benches",
  },
  {
    id: "ctmo",
    label: "CTMO",
    x: 234,
    y: 194,
    w: 59,
    h: 88,
    tone: "soft",
    type: "Office",
    nodeId: "CTMO building",
    buildingId: "ctmo",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    x: 13,
    y: 318,
    w: 52,
    h: 96,
    tone: "soft",
    type: "Maintenance room",
    nodeId: "Maintenance room",
    vertical: true,
    fontSize: 10,
  },
  {
    id: "canteen",
    label: "Canteen",
    x: 13,
    y: 458,
    w: 52,
    h: 164,
    tone: "soft",
    type: "Canteen",
    nodeId: "Canteen area",
    vertical: true,
  },
  {
    id: "gym",
    label: "Gymnasium",
    x: 229,
    y: 303,
    w: 94,
    h: 284,
    tone: "mid",
    type: "Gymnasium",
    nodeId: "Gymnasium",
    vertical: true,
    fontSize: 13,
  },
  {
    id: "stage",
    label: "Stage",
    x: 247,
    y: 546,
    w: 58,
    h: 41,
    tone: "soft",
    type: "Stage",
    nodeId: "Stage",
    fontSize: 10,
  },
  {
    id: "smart",
    label: "Smart Room",
    x: 229,
    y: 608,
    w: 96,
    h: 60,
    tone: "soft",
    type: "Smart room",
    nodeId: "Smart Room",
  },
  {
    id: "learning",
    label: "Learning Room",
    x: 82,
    y: 638,
    w: 128,
    h: 47,
    tone: "soft",
    type: "Learning room",
    nodeId: "Learning Room",
  },
];

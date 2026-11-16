import type { GraphEdge, GraphNode, NodeId } from "./graph";

const INDOOR_METERS_PER_PIXEL = 0.04;

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];

interface PlaceSpec {
  code: string;
  name: string;
  x: number;
  y: number;
  claimable?: boolean;
}

function find(id: NodeId): GraphNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`oldBuilding: no node with id "${id}"`);
  return node;
}

function link(from: NodeId, to: NodeId): void {
  const a = find(from);
  const b = find(to);
  const meters = Math.hypot(a.x - b.x, a.y - b.y) * INDOOR_METERS_PER_PIXEL;
  edges.push({ from, to, weight: Math.round(meters * 10) / 10 });
}

function addHall(floor: number, code: string, x: number, y: number): NodeId {
  const id = `OB-${floor}-${code}`;
  nodes.push({
    id,
    name: `Old Building ${floor}F hallway ${code}`,
    x,
    y,
    kind: "junction",
    floor,
    claimable: false,
  });
  return id;
}

function addPlace(floor: number, hallId: NodeId, place: PlaceSpec): void {
  const id = `OB-${floor}-${place.code}`;
  nodes.push({
    id,
    name: place.name,
    x: place.x,
    y: place.y,
    kind: "entrance",
    floor,
    claimable: place.claimable ?? false,
  });
  link(hallId, id);
}

const c1 = addHall(2, "C1", 700, 600);
const c2 = addHall(2, "C2", 700, 860);
const c3 = addHall(2, "C3", 700, 1016);
const c4 = addHall(2, "C4", 700, 1300);
const c5 = addHall(2, "C5", 700, 1480);
const e0 = addHall(2, "E0", 920, 860);
const e1 = addHall(2, "E1", 920, 777);
const e2 = addHall(2, "E2", 960, 1170);
const e3 = addHall(2, "E3", 960, 1335);

link(c1, c2);
link(c2, c3);
link(c3, c4);
link(c4, c5);
link(c2, e0);
link(e0, e1);
link(e0, e2);
link(e2, e3);
link(e3, c4);

addPlace(2, c1, {
  code: "CL-N",
  name: "CL Building north (Old Building)",
  x: 282,
  y: 559,
  claimable: true,
});
addPlace(2, c1, {
  code: "FACULTY",
  name: "Faculty Room (Old Building)",
  x: 745,
  y: 637,
  claimable: true,
});
addPlace(2, c3, {
  code: "FUNCTION",
  name: "Function Hall (Old Building)",
  x: 660,
  y: 1016,
});
addPlace(2, e1, {
  code: "LIBRARY",
  name: "Library (Old Building)",
  x: 967,
  y: 777,
});
addPlace(2, e2, {
  code: "STOCK1",
  name: "Stock Room 1 (Old Building)",
  x: 1005,
  y: 1124,
});
addPlace(2, e2, {
  code: "STOCK2",
  name: "Stock Room 2 (Old Building)",
  x: 1005,
  y: 1214,
});
addPlace(2, e3, {
  code: "CLASSROOM",
  name: "Classroom 2F (Old Building)",
  x: 1005,
  y: 1335,
  claimable: true,
});
addPlace(2, c5, {
  code: "ORG",
  name: "Organization Office (Old Building)",
  x: 843,
  y: 1482,
});
addPlace(2, c5, {
  code: "CL-S",
  name: "CL Building south (Old Building)",
  x: 282,
  y: 1473,
  claimable: true,
});

const hall1 = addHall(1, "HALL", 450, 953);

const floor1Places: PlaceSpec[] = [
  { code: "CHEMISTRY", name: "Chemistry Lab RM 120", x: 230, y: 337, claimable: true },
  { code: "HEALTH", name: "Health Science Lab RM 121", x: 330, y: 337, claimable: true },
  { code: "BIOLOGY", name: "Biology Lab RM 122", x: 435, y: 337, claimable: true },
  { code: "CLINIC", name: "Clinic", x: 585, y: 337 },
  { code: "STUDENT-GOV", name: "Student Government Office", x: 690, y: 418, claimable: true },
  { code: "RM119", name: "RM 119", x: 410, y: 985, claimable: true },
  { code: "RM118", name: "RM 118", x: 410, y: 1090, claimable: true },
  { code: "RM115", name: "RM 115", x: 610, y: 985, claimable: true },
  { code: "RM114", name: "RM 114", x: 610, y: 1090, claimable: true },
  { code: "RADIO", name: "Radio Room", x: 725, y: 1040, claimable: true },
  { code: "RM117", name: "RM 117", x: 610, y: 1180, claimable: true },
  { code: "RM116", name: "RM 116", x: 610, y: 1280, claimable: true },
  { code: "RM112", name: "RM 112", x: 765, y: 1180, claimable: true },
  { code: "RM113", name: "RM 113", x: 765, y: 1280, claimable: true },
  {
    code: "HM",
    name: "HM LAB",
    x: 119,
    y: 907,
    claimable: true,
  },
  {
    code: "STOCK-A",
    name: "Stock Room A",
    x: 222,
    y: 1108,
    claimable: true,
  },
  {
    code: "STOCK-B",
    name: "Stock Room B",
    x: 119,
    y: 1064,
    claimable: true,
  },
  {
    code: "CLASS-A",
    name: "RM 107",
    x: 560,
    y: 1155,
    claimable: true,
  },
  {
    code: "CLASS-B",
    name: "RM 106",
    x: 557,
    y: 1068,
    claimable: true,
  },
  {
    code: "CLASS-C",
    name: "RM 105",
    x: 470,
    y: 1356,
    claimable: true,
  },
  {
    code: "CLASS-D",
    name: "RM 104",
    x: 363,
    y: 1356,
    claimable: true,
  },
  {
    code: "CLASS-E",
    name: "RM 103",
    x: 286,
    y: 1356,
    claimable: true,
  },
  {
    code: "FACULTY-1F",
    name: "Faculty Room 1F",
    x: 624,
    y: 1352,
    claimable: true,
  },
  {
    code: "CR-A",
    name: "CR A",
    x: 734,
    y: 1395,
  },
  {
    code: "CR-B",
    name: "CR B",
    x: 751,
    y: 1315,
  },
  {
    code: "CONFERENCE",
    name: "Conference Room",
    x: 838,
    y: 1328,
    claimable: true,
  },
  {
    code: "SUPPLY",
    name: "Supply Office",
    x: 928,
    y: 1359,
    claimable: true,
  },
  {
    code: "MULTIMEDIA",
    name: "Multimedia Room",
    x: 1005,
    y: 1328,
    claimable: true,
  },
];

floor1Places.forEach((place) => addPlace(1, hall1, place));

nodes.push({
  id: "OB-1-ENTRANCE",
  name: "Old Building entrance",
  x: 888,
  y: 897,
  kind: "gate",
  floor: 1,
  claimable: false,
});
link("OB-1-ENTRANCE", hall1);

nodes.push(
  {
    id: "OB-1-CL-N-EXIT",
    name: "Exit to CL 1-4",
    x: 900,
    y: 1040,
    kind: "gate",
    floor: 1,
    claimable: false,
  },
  {
    id: "OB-1-CL-S-EXIT",
    name: "Exit to CL 5-8",
    x: 900,
    y: 1190,
    kind: "gate",
    floor: 1,
    claimable: false,
  },
);
link("OB-1-CL-N-EXIT", hall1);
link("OB-1-CL-S-EXIT", hall1);

const imagePositions: Record<string, { x: number; y: number }> = {
  "OB-1-HALL": { x: 520, y: 600 },
  "OB-1-ENTRANCE": { x: 636, y: 1018 },
  "OB-1-CL-N-EXIT": { x: 430, y: 180 },
  "OB-1-CL-S-EXIT": { x: 690, y: 180 },
  "OB-1-CHEMISTRY": { x: 230, y: 337 },
  "OB-1-HEALTH": { x: 330, y: 337 },
  "OB-1-BIOLOGY": { x: 436, y: 337 },
  "OB-1-CLINIC": { x: 587, y: 335 },
  "OB-1-STUDENT-GOV": { x: 691, y: 418 },
  "OB-1-RM119": { x: 231, y: 485 },
  "OB-1-RM118": { x: 231, y: 542 },
  "OB-1-RM115": { x: 389, y: 487 },
  "OB-1-RM114": { x: 389, y: 545 },
  "OB-1-RADIO": { x: 466, y: 786 },
  "OB-1-RM117": { x: 234, y: 758 },
  "OB-1-RM116": { x: 234, y: 817 },
  "OB-1-RM112": { x: 389, y: 760 },
  "OB-1-RM113": { x: 389, y: 817 },
  "OB-1-HM": { x: 95, y: 647 },
  "OB-1-STOCK-A": { x: 83, y: 758 },
  "OB-1-STOCK-B": { x: 84, y: 520 },
  "OB-1-CLASS-A": { x: 207, y: 963 },
  "OB-1-CLASS-B": { x: 264, y: 963 },
  "OB-1-CLASS-C": { x: 341, y: 963 },
  "OB-1-CLASS-D": { x: 444, y: 963 },
  "OB-1-CLASS-E": { x: 714, y: 935 },
  "OB-1-FACULTY-1F": { x: 444, y: 963 },
  "OB-1-CR-A": { x: 519, y: 1010 },
  "OB-1-CR-B": { x: 519, y: 930 },
  "OB-1-CONFERENCE": { x: 595, y: 935 },
  "OB-1-SUPPLY": { x: 663, y: 956 },
  "OB-1-MULTIMEDIA": { x: 714, y: 935 },
  "OB-2-C1": { x: 300, y: 380 },
  "OB-2-C2": { x: 300, y: 500 },
  "OB-2-C3": { x: 300, y: 680 },
  "OB-2-C4": { x: 300, y: 900 },
  "OB-2-C5": { x: 300, y: 1010 },
  "OB-2-E0": { x: 520, y: 650 },
  "OB-2-E1": { x: 520, y: 500 },
  "OB-2-E2": { x: 620, y: 780 },
  "OB-2-E3": { x: 620, y: 900 },
  "OB-2-CL-N": { x: 117, y: 378 },
  "OB-2-FACULTY": { x: 550, y: 450 },
  "OB-2-FUNCTION": { x: 135, y: 680 },
  "OB-2-LIBRARY": { x: 700, y: 530 },
  "OB-2-STOCK1": { x: 716, y: 767 },
  "OB-2-STOCK2": { x: 716, y: 830 },
  "OB-2-CLASSROOM": { x: 716, y: 913 },
  "OB-2-ORG": { x: 660, y: 1014 },
  "OB-2-CL-S": { x: 117, y: 1010 },
};

const walkablePointGroups = [
  [38, 39, 40],
  [41, 42, 43, 44, 40, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
  [56, 57, 58, 59, 60, 61, 62, 63, 64],
  [65, 66, 67, 68, 69, 70, 71, 72],
  [73, 74, 76, 75],
  [77, 78, 79],
  [84, 83, 60, 82, 81, 78, 77],
  [86, 84, 85],
  [87, 88, 89, 90, 91],
  [92, 93, 94, 95],
  [96, 87],
] as const;

const walkablePointCoordinates: Record<number, { x: number; y: number }> = {
  1: { x: 680.9, y: 701.4 }, 2: { x: 643.9, y: 703.7 }, 3: { x: 605, y: 704.9 },
  4: { x: 562.2, y: 707.2 }, 5: { x: 522, y: 709.6 }, 6: { x: 527, y: 737.9 },
  7: { x: 518.2, y: 768.5 }, 8: { x: 519.5, y: 787.4 }, 9: { x: 522, y: 821.5 },
  10: { x: 520.7, y: 843.9 }, 11: { x: 515.7, y: 872.2 }, 12: { x: 508.2, y: 895.8 },
  13: { x: 506.9, y: 937 }, 14: { x: 535.8, y: 874.6 }, 15: { x: 538.3, y: 840.4 },
  16: { x: 539.6, y: 802.7 }, 17: { x: 540.9, y: 761.4 }, 18: { x: 549.7, y: 737.9 },
  19: { x: 581.1, y: 737.9 }, 20: { x: 611.3, y: 734.3 }, 21: { x: 631.4, y: 734.3 },
  22: { x: 588.6, y: 755.6 }, 23: { x: 589.9, y: 779.1 }, 24: { x: 593.7, y: 816.8 },
  25: { x: 608.7, y: 823.9 }, 26: { x: 623.8, y: 833.3 }, 27: { x: 637.7, y: 854.5 },
  28: { x: 656.5, y: 862.8 }, 29: { x: 519.5, y: 687.2 }, 30: { x: 519.5, y: 653 },
  31: { x: 520.7, y: 608.3 }, 32: { x: 522, y: 588.2 }, 33: { x: 518.2, y: 554.1 },
  34: { x: 514.5, y: 512.8 }, 35: { x: 515.7, y: 482.2 }, 36: { x: 520.7, y: 433.9 },
  37: { x: 518.2, y: 383.2 }, 38: { x: 517, y: 479.8 }, 39: { x: 522, y: 372.6 },
  40: { x: 682.9, y: 590.6 }, 41: { x: 630.1, y: 587.1 }, 42: { x: 598.7, y: 591.8 },
  43: { x: 567.3, y: 596.5 }, 44: { x: 539.6, y: 597.7 }, 45: { x: 550.9, y: 694.3 },
  46: { x: 550.9, y: 657.8 }, 47: { x: 548.4, y: 624.8 }, 48: { x: 579.8, y: 689.6 },
  49: { x: 581.1, y: 661.3 }, 50: { x: 576.1, y: 630.7 }, 51: { x: 608.7, y: 687.2 },
  52: { x: 608.7, y: 656.6 }, 53: { x: 602.5, y: 628.3 }, 54: { x: 635.1, y: 686 },
  55: { x: 635.1, y: 646 }, 56: { x: 633.9, y: 625.9 }, 57: { x: 542.1, y: 581.2 },
  58: { x: 539.6, y: 550.5 }, 59: { x: 538.3, y: 524.6 }, 60: { x: 537.1, y: 486.9 },
  61: { x: 532.1, y: 438.6 }, 62: { x: 564.7, y: 570.6 }, 63: { x: 563.5, y: 529.3 },
  64: { x: 564.7, y: 484.5 }, 65: { x: 582.3, y: 569.4 }, 66: { x: 592.4, y: 515.2 },
  67: { x: 599.9, y: 489.3 }, 68: { x: 613.8, y: 562.3 }, 69: { x: 626.3, y: 472.8 },
  70: { x: 554.7, y: 759.1 }, 71: { x: 557.2, y: 780.3 }, 72: { x: 563.5, y: 812.1 },
  73: { x: 577.3, y: 832.2 }, 74: { x: 488.1, y: 867.5 }, 75: { x: 442.8, y: 865.1 },
  76: { x: 417.6, y: 861.6 }, 77: { x: 377.4, y: 858.1 }, 78: { x: 325.9, y: 861.6 },
  79: { x: 256.7, y: 862.8 }, 80: { x: 210.2, y: 856.9 }, 81: { x: 175, y: 855.7 },
  82: { x: 151.1, y: 874.6 }, 83: { x: 153.6, y: 892.2 }, 84: { x: 152.4, y: 902.9 },
  85: { x: 195.1, y: 874.6 }, 86: { x: 232.8, y: 876.9 }, 87: { x: 270.6, y: 886.4 },
  88: { x: 312, y: 885.2 }, 89: { x: 346, y: 872.2 }, 90: { x: 402.6, y: 878.1 },
  91: { x: 459.1, y: 881.6 }, 92: { x: 305.8, y: 851 }, 93: { x: 307, y: 818 },
  94: { x: 308.3, y: 787.4 }, 95: { x: 310.8, y: 765 }, 96: { x: 310.8, y: 717.9 },
  97: { x: 307, y: 739.1 }, 98: { x: 308.3, y: 683.7 }, 99: { x: 310.8, y: 653 },
  100: { x: 309.5, y: 631.8 }, 101: { x: 309.5, y: 610.6 }, 102: { x: 304.5, y: 592.9 },
  103: { x: 304.5, y: 571.7 }, 104: { x: 309.5, y: 555.2 }, 105: { x: 305.8, y: 530.5 },
  106: { x: 304.5, y: 506.9 }, 107: { x: 302, y: 468 }, 108: { x: 304.5, y: 498.7 },
  109: { x: 302, y: 461 }, 110: { x: 298.2, y: 451.5 }, 111: { x: 154.9, y: 405.6 },
  112: { x: 153.6, y: 442.1 }, 113: { x: 188.8, y: 446.8 }, 114: { x: 211.5, y: 444.5 },
  115: { x: 244.2, y: 449.2 }, 116: { x: 271.8, y: 448 }, 117: { x: 295.7, y: 443.3 },
  118: { x: 332.2, y: 443.3 }, 119: { x: 374.9, y: 444.5 }, 120: { x: 400, y: 445.7 },
  121: { x: 430.2, y: 444.5 }, 122: { x: 476.7, y: 444.5 }, 123: { x: 490.6, y: 417.4 },
  124: { x: 436.5, y: 424.4 }, 125: { x: 396.3, y: 423.3 }, 126: { x: 359.8, y: 425.6 },
  127: { x: 325.9, y: 424.4 }, 128: { x: 294.4, y: 424.4 }, 129: { x: 244.2, y: 424.4 },
  130: { x: 211.5, y: 423.3 }, 131: { x: 181.3, y: 424.4 }, 132: { x: 275.6, y: 703.7 },
  133: { x: 275.6, y: 670.7 }, 134: { x: 269.3, y: 629.5 }, 135: { x: 269.3, y: 596.5 },
  136: { x: 235.4, y: 700.2 }, 137: { x: 231.6, y: 671.9 }, 138: { x: 234.1, y: 635.4 },
  139: { x: 234.1, y: 610.6 }, 140: { x: 196.4, y: 689.6 }, 141: { x: 193.9, y: 654.2 },
  142: { x: 196.4, y: 609.4 }, 143: { x: 334.7, y: 710.8 }, 144: { x: 334.7, y: 674.3 },
  145: { x: 334.7, y: 648.3 }, 146: { x: 329.6, y: 600 }, 147: { x: 358.6, y: 702.5 },
  148: { x: 366.1, y: 662.5 }, 149: { x: 364.8, y: 642.4 }, 150: { x: 361.1, y: 615.3 },
  151: { x: 383.7, y: 666 }, 152: { x: 406.3, y: 666 }, 153: { x: 383.7, y: 636.5 },
  154: { x: 422.7, y: 637.7 }, 155: { x: 457.9, y: 635.4 }, 156: { x: 485.5, y: 646 },
  157: { x: 469.2, y: 716.7 }, 158: { x: 499.4, y: 709.6 }, 159: { x: 447.8, y: 677.8 },
  160: { x: 488.1, y: 673.1 }, 161: { x: 459.1, y: 620 }, 162: { x: 493.1, y: 623.6 },
  163: { x: 475.5, y: 600 }, 164: { x: 493.1, y: 594.1 },
};

function alignY(numbers: number[], y: number): void {
  numbers.forEach((number) => {
    walkablePointCoordinates[number].y = y;
  });
}

function alignX(numbers: number[], x: number): void {
  numbers.forEach((number) => {
    walkablePointCoordinates[number].x = x;
  });
}

alignY([1, 2, 3, 4, 5, 157, 158], 705);
alignX([5, 6, 7, 8, 9, 10, 11, 12, 13], 520);
alignX([14, 15, 16, 17, 18], 538);
alignY([18, 19, 20, 21], 738);
alignX([29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39], 520);
alignY([40, 41, 42, 43, 44], 593);
alignX([45, 46, 47], 550);
alignX([48, 49, 50], 580);
alignX([51, 52, 53], 609);
alignX([54, 55, 56], 635);
alignX([57, 58, 59, 60, 61], 540);
alignX([62, 63, 64], 564);
alignY([74, 75, 76, 77, 78, 79, 80, 81], 863);
alignX([82, 83, 84], 152);
alignY([85, 86, 87, 88, 89, 90, 91], 878);
alignX([92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110], 307);
alignY([112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122], 444);
alignY([123, 124, 125, 126, 127, 128, 129, 130, 131], 424);
alignX([132, 133, 134, 135], 270);
alignX([136, 137, 138, 139], 234);
alignX([140, 141, 142], 195);
alignX([143, 144, 145, 146], 334);
alignX([147, 148, 149, 150], 362);
alignY([151, 152], 666);
alignY([153, 154, 155, 156], 640);
alignY([159, 160], 676);
alignY([161, 162], 622);
alignY([163, 164], 597);

const suppliedPathCoordinates: Record<number, { x: number; y: number }> = {
  38: { x: 616.3, y: 705.1 },
  39: { x: 577.3, y: 702.6 },
  40: { x: 539.6, y: 701.4 },
  41: { x: 618.8, y: 585.7 },
  42: { x: 579.8, y: 584.4 },
  43: { x: 535.8, y: 585.7 },
  44: { x: 537.1, y: 648.6 },
  45: { x: 535.8, y: 747.9 },
  46: { x: 532.1, y: 790.6 },
  47: { x: 532.1, y: 845.9 },
  48: { x: 528.3, y: 878.6 },
  49: { x: 483, y: 879.9 },
  50: { x: 429, y: 879.9 },
  51: { x: 376.2, y: 878.6 },
  52: { x: 324.6, y: 877.4 },
  53: { x: 263, y: 876.1 },
  54: { x: 208.9, y: 876.1 },
  55: { x: 162.4, y: 874.9 },
  56: { x: 308.3, y: 844.7 },
  57: { x: 305.8, y: 803.2 },
  58: { x: 303.2, y: 751.6 },
  59: { x: 305.8, y: 690 },
  60: { x: 305.8, y: 651.1 },
  61: { x: 308.3, y: 612.1 },
  62: { x: 302, y: 560.6 },
  63: { x: 307, y: 511.5 },
  64: { x: 307, y: 467.5 },
  65: { x: 152.4, y: 432.3 },
  66: { x: 207.7, y: 434.8 },
  67: { x: 254.2, y: 432.3 },
  68: { x: 299.5, y: 433.6 },
  69: { x: 358.6, y: 434.8 },
  70: { x: 393.8, y: 434.8 },
  71: { x: 449.1, y: 433.6 },
  72: { x: 490.6, y: 433.6 },
  73: { x: 520.7, y: 394.6 },
  74: { x: 522, y: 439.9 },
  75: { x: 529.5, y: 541.7 },
  76: { x: 525.8, y: 488.9 },
  77: { x: 501.9, y: 651.1 },
  78: { x: 465.4, y: 653.6 },
  79: { x: 460.4, y: 701.4 },
  80: { x: 459.1, y: 613.4 },
  81: { x: 415.1, y: 654.8 },
  82: { x: 362.3, y: 654.8 },
  83: { x: 258, y: 652.3 },
  84: { x: 211.5, y: 653.6 },
  85: { x: 208.9, y: 700.1 },
  86: { x: 215.2, y: 607.1 },
  87: { x: 589.9, y: 737.8 },
  88: { x: 588.6, y: 780.6 },
  89: { x: 588.6, y: 823.3 },
  90: { x: 626.3, y: 840.9 },
  91: { x: 650.2, y: 867.3 },
  92: { x: 588.6, y: 545.5 },
  93: { x: 584.9, y: 502.7 },
  94: { x: 589.9, y: 470 },
  95: { x: 620.1, y: 472.5 },
  96: { x: 586.1, y: 648.6 },
};
Object.keys(walkablePointCoordinates).forEach((key) => {
  delete walkablePointCoordinates[Number(key)];
});
Object.assign(walkablePointCoordinates, suppliedPathCoordinates);

const walkableNodes: GraphNode[] = Object.entries(walkablePointCoordinates).map(
  ([number, position]) => ({
    id: `OB-1-P${number.padStart(2, "0")}`,
    name: `Old Building 1F walkable node ${number}`,
    ...position,
    kind: "junction",
    floor: 1,
    claimable: false,
  }),
);

const doorPointCoordinates: Record<number, { x: number; y: number }> = {
  1: { x: 650.7, y: 701.4 },
  2: { x: 650.5, y: 583.2 },
  3: { x: 149.9, y: 907.5 },
  4: { x: 149.9, y: 397.1 },
  5: { x: 689.2, y: 876.1 },
  6: { x: 646.2, y: 895 },
  7: { x: 556.7, y: 881.1 },
  8: { x: 504.9, y: 972.9 },
  9: { x: 416.6, y: 908.8 },
  10: { x: 317.1, y: 908.8 },
  11: { x: 181, y: 936.5 },
  12: { x: 272.8, y: 908.8 },
  13: { x: 458.4, y: 736.6 },
  14: { x: 338.9, y: 770.5 },
  15: { x: 283.6, y: 769.2 },
  16: { x: 282.4, y: 829.6 },
  17: { x: 338.9, y: 828.3 },
  18: { x: 279.9, y: 558 },
  19: { x: 335.2, y: 561.8 },
  20: { x: 279.9, y: 495.2 },
  21: { x: 340.2, y: 497.7 },
  22: { x: 175.5, y: 686.3 },
  23: { x: 178, y: 604.6 },
  24: { x: 73.7, y: 583.2 },
  25: { x: 458.4, y: 574.4 },
  27: { x: 622.6, y: 421 },
  28: { x: 646.5, y: 418.5 },
  29: { x: 649, y: 359.4 },
  30: { x: 621.3, y: 314.1 },
  31: { x: 522, y: 344.3 },
  32: { x: 407.6, y: 393.3 },
  33: { x: 465.4, y: 394.6 },
  34: { x: 295.7, y: 394.6 },
  35: { x: 354.8, y: 395.9 },
  36: { x: 198.9, y: 395.9 },
  37: { x: 255.5, y: 398.4 },
};

const doorNodes: GraphNode[] = Object.entries(doorPointCoordinates).map(
  ([number, position]) => ({
    id: `OB-1-D${number.padStart(2, "0")}`,
    name: Number(number) <= 4
      ? `Old Building 1F exit door ${number}`
      : `Old Building 1F door ${number}`,
    ...position,
    kind: "junction",
    floor: 1,
    claimable: false,
  }),
);

function walkableNodeId(number: number): NodeId {
  return `OB-1-P${number.toString().padStart(2, "0")}`;
}

function doorNodeId(number: number): NodeId {
  return `OB-1-D${number.toString().padStart(2, "0")}`;
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
}

const walkableEdges: GraphEdge[] = [];
for (const group of walkablePointGroups) {
  for (let index = 1; index < group.length; index += 1) {
    const from = group[index - 1];
    const to = group[index];
    walkableEdges.push({
      from: walkableNodeId(from),
      to: walkableNodeId(to),
      weight: distanceBetween(
        walkablePointCoordinates[from],
        walkablePointCoordinates[to],
      ),
    });
  }
}

const connectingWalkableEdges: [number, number][] = [
  [64, 68],
  [72, 74],
  [75, 43],
  [75, 92],
  [44, 96],
  [78, 80],
  [79, 40],
];
for (const [from, to] of connectingWalkableEdges) {
  walkableEdges.push({
    from: walkableNodeId(from),
    to: walkableNodeId(to),
    weight: distanceBetween(
      walkablePointCoordinates[from],
      walkablePointCoordinates[to],
    ),
  });
}

const doorPathConnections: Record<number, number> = {
  1: 38,
  2: 41,
  3: 55,
  4: 65,
  5: 91,
  6: 91,
  7: 48,
  8: 48,
  9: 50,
  10: 52,
  11: 55,
  12: 53,
  13: 79,
  14: 58,
  15: 58,
  16: 57,
  17: 56,
  18: 62,
  19: 62,
  20: 63,
  21: 63,
  22: 85,
  23: 86,
  24: 86,
  25: 80,
  27: 95,
  28: 95,
  29: 95,
  30: 95,
  31: 73,
  32: 69,
  33: 72,
  34: 68,
  35: 69,
  36: 65,
  37: 67,
};
const doorPathEdges: GraphEdge[] = Object.entries(doorPathConnections).map(
  ([doorNumber, pathNumber]) => {
    const door = doorNodes.find((node) => node.id === doorNodeId(Number(doorNumber)));
    const path = walkableNodes.find((node) => node.id === walkableNodeId(pathNumber));
    if (!door || !path) {
      throw new Error(`oldBuilding: invalid door/path connection ${doorNumber} -> ${pathNumber}`);
    }
  return {
    from: door.id,
    to: path.id,
    weight: distanceBetween(door, path),
  };
  },
);

const walkableNodeIds = new Set(walkableNodes.map((node) => node.id));
const exitDoorIds = new Set([1, 2, 3, 4].map(doorNodeId));
const walkableAdjacency = new Map(
  [...walkableNodes, ...doorNodes].map((node) => [
    node.id,
    new Set<NodeId>(),
  ]),
);
for (const edge of [...walkableEdges, ...doorPathEdges]) {
  if (
    (!walkableNodeIds.has(edge.from) && !doorNodes.some((node) => node.id === edge.from)) ||
    (!walkableNodeIds.has(edge.to) && !doorNodes.some((node) => node.id === edge.to))
  ) {
    continue;
  }
  walkableAdjacency.get(edge.from)?.add(edge.to);
  walkableAdjacency.get(edge.to)?.add(edge.from);
}

const visitedExitNetwork = new Set<NodeId>();
const pendingExitNetwork = [...exitDoorIds];
while (pendingExitNetwork.length > 0) {
  const nodeId = pendingExitNetwork.pop();
  if (!nodeId || visitedExitNetwork.has(nodeId)) continue;
  visitedExitNetwork.add(nodeId);
  pendingExitNetwork.push(...(walkableAdjacency.get(nodeId) ?? []));
}
const validPathAndDoorCount = walkableNodes.length + doorNodes.length;
if (visitedExitNetwork.size !== validPathAndDoorCount) {
  throw new Error(
    "oldBuilding: every valid door and pathway node must reach exit doors 1-4",
  );
}

const positionedNodes = nodes.map((node) => {
  const position = imagePositions[node.id];
  return position ? { ...node, ...position } : node;
});

const positionedNodeById = new Map(
  positionedNodes.map((node) => [node.id, node]),
);
const floor1AccessibleNodeIds = new Set(
  positionedNodes
    .filter(
      (node) =>
        node.floor === 1 &&
        (node.kind === "entrance" || node.kind === "gate"),
    )
    .map((node) => node.id),
);
const nearestDoorNode = (nodeId: string): GraphNode => {
  const node = positionedNodeById.get(nodeId);
  if (!node) throw new Error(`oldBuilding: no node with id "${nodeId}"`);
  return doorNodes.reduce((nearest, candidate) =>
    distanceBetween(node, candidate) < distanceBetween(node, nearest)
      ? candidate
      : nearest,
  );
};

const roomDoorEdges: GraphEdge[] = [];
for (const roomId of floor1AccessibleNodeIds) {
  const nearest = nearestDoorNode(roomId);
  const room = positionedNodeById.get(roomId);
  if (!room) continue;
  roomDoorEdges.push({
    from: roomId,
    to: nearest.id,
    weight: distanceBetween(room, nearest),
  });
}

const hallWalkableEdge: GraphEdge = {
  from: hall1,
  to: walkableNodeId(43),
  weight: distanceBetween(
    imagePositions[hall1],
    walkablePointCoordinates[43],
  ),
};
const directRoomEdges = edges.filter(
  (edge) =>
    !(
      edge.from === hall1 &&
      floor1AccessibleNodeIds.has(edge.to)
    ) &&
    !(
      edge.to === hall1 &&
      floor1AccessibleNodeIds.has(edge.from)
    ),
);

export const oldBuildingNodes: GraphNode[] = [
  ...positionedNodes,
  ...walkableNodes,
  ...doorNodes,
];
export const oldBuildingEdges: GraphEdge[] = [
  ...directRoomEdges,
  ...walkableEdges,
  ...doorPathEdges,
  ...roomDoorEdges,
  hallWalkableEdge,
];

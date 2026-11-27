"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./CampusMap.module.css";
import ZoomPan from "./ZoomPan";
import { useMobileUi } from "@/lib/useMobileUi";
import campusMap01 from "../assets/ATLAS-map-01.png";
import campusMap02 from "../assets/ATLAS-map-02.png";
import campusMap03 from "../assets/ATLAS-map-03.png";
import campusMap05 from "../assets/ATLAS-map-05.png";
import campusMap06 from "../assets/ATLAS-map-06.png";
import campusMap07 from "../assets/ATLAS-map-07.png";
import campusMap08 from "../assets/ATLAS-map-08.png";
import campusMap09 from "../assets/ATLAS-map-09.png";
import campusMap10 from "../assets/ATLAS-map-10.png";
import campusMap11 from "../assets/ATLAS-map-11.png";
import { campusGraph } from "@/lib/graph";
import { routingGraph, routingNodeById } from "@/lib/routingGraph";
import { findShortestPath } from "@/lib/pathfinding";
import {
  buildingById,
  buildingOfNode,
  buildings,
  campusShapes,
  CAMPUS_VIEWBOX,
  planPoint,
  planRect,
  planViewBox,
} from "@/lib/mapData";
import type { BuildingId, CampusShape, PlanRoom, Rect } from "@/lib/mapData";
import {
  buildingDisplayName, buildingNameKey, displayName, fitMapLabel,
  floorDisplayName, floorNameKey, syntheticRoomNameKey,
} from "@/lib/locationNames";

type Phase = "campus" | "in" | "building" | "out";
type Pt = { x: number; y: number };
type BuilderPoint = {
  id: number;
  mapKey: string;
  label: string;
  x: number;
  y: number;
  displayX: number;
  displayY: number;
};
type BuilderCoordinates = {
  x: number;
  y: number;
  displayX: number;
  displayY: number;
};
type AdminNameItem = {
  id: string;
  kind: "building" | "floor" | "room" | "area";
  name: string;
  fallbackName: string;
  context: string;
  buildingId?: BuildingId;
  floor?: number;
  nodeId?: string;
};

const nodeById = routingNodeById;

const edgeWeight = new Map<string, number>();
campusGraph.edges.forEach((e) => {
  edgeWeight.set(`${e.from}|${e.to}`, e.weight);
  edgeWeight.set(`${e.to}|${e.from}`, e.weight);
});

const outdoorEdges = campusGraph.edges.filter(
  (e) => !buildingOfNode(e.from) && !buildingOfNode(e.to),
);

const clExitPoints: Record<"cl-n" | "cl-s", Pt> = {
  "cl-n": { x: 132, y: 306 },
  "cl-s": { x: 132, y: 590 },
};

function clExitForNode(id: string): Pt | null {
  if (id.startsWith("CL-N-") || id === "OB-1-CL-N-EXIT" || id === "OB-2-CL-N") {
    return clExitPoints["cl-n"];
  }
  if (id.startsWith("CL-S-") || id === "OB-1-CL-S-EXIT" || id === "OB-2-CL-S") {
    return clExitPoints["cl-s"];
  }
  return null;
}

const indoorImages: Record<
  string,
  { src: string; width: number; height: number; rotate?: boolean }
> = {
  "old-1": { src: campusMap02.src, width: 1365, height: 768 },
  "old-2": { src: campusMap03.src, width: 1365, height: 768 },
  ctmo: { src: campusMap07.src, width: 1365, height: 768 },
  gym: { src: campusMap08.src, width: 1365, height: 768 },
  "cl-n": { src: campusMap06.src, width: 1365, height: 768 },
  "cl-s": { src: campusMap05.src, width: 1365, height: 768 },
  "hm-1": { src: campusMap09.src, width: 1365, height: 768 },
  "hm-2": { src: campusMap10.src, width: 1365, height: 768 },
  "hm-3": { src: campusMap11.src, width: 1365, height: 768 },
};

function rotateOldRect(rect: Rect): Rect {
  return {
    x: 1365 - (rect.y + rect.h),
    y: rect.x,
    w: rect.h,
    h: rect.w,
  };
}

function hotspotRect(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
  mapWidth = 1365,
  mapHeight = 768,
): Rect {
  return {
    x: (xPercent / 100) * mapWidth,
    y: (yPercent / 100) * mapHeight,
    w: (widthPercent / 100) * mapWidth,
    h: (heightPercent / 100) * mapHeight,
  };
}

function imageRoomRect(
  buildingId: BuildingId,
  floorNumber: number,
  roomId: string,
): Rect | null {
  if (buildingId === "ctmo") {
    const xPercent: Record<string, number> = {
      "ctmo-1": 13.7,
      "ctmo-2": 28.4,
      "ctmo-3": 43.0,
      "ctmo-gad": 57.6,
      "ctmo-res": 72.2,
    };
    return xPercent[roomId] === undefined
      ? null
      : hotspotRect(xPercent[roomId], 19.7, 14.1, 58.0);
  }
  if (buildingId === "cl-n" || buildingId === "cl-s") {
    if (roomId === "stairs") {
      return hotspotRect(buildingId === "cl-n" ? 92.3 : 92.7, 46.9, 6.6, 18.9);
    }
    const start = buildingId === "cl-n" ? 5 : 1;
    const roomNumber = Number(roomId.split("-").pop());
    if (!Number.isInteger(roomNumber)) return null;
    const index = roomNumber - start;
    const xPercent = (buildingId === "cl-n" ? 3.6 : 4.1) + (3 - index) * 20.9;
    return hotspotRect(xPercent, 26.6, 20.0, 38.3);
  }
  if (buildingId === "hm" && floorNumber >= 1 && floorNumber <= 3) {
    if (roomId === `stairs-${floorNumber}`) {
      const stairCoordinates: Record<number, [number, number]> = {
        1: [65.3, 60.7],
        2: [66.4, 67.8],
        3: [64.9, 67.8],
      };
      return hotspotRect(
        stairCoordinates[floorNumber][0],
        stairCoordinates[floorNumber][1],
        23.2,
        25.8,
      );
    }
    const number = Number(roomId.split("-").pop());
    const index = (number % 100) - 1;
    const floorCoordinates: Record<
      number,
      { left: number; right: number; y: number }
    > = {
      1: { left: 10.0, right: 50.3, y: 6.9 },
      2: { left: 11.2, right: 51.4, y: 14.1 },
      3: { left: 9.6, right: 49.7, y: 14.1 },
    };
    const coordinates = floorCoordinates[floorNumber];
    return hotspotRect(
      index === 0 ? coordinates.right : coordinates.left,
      coordinates.y,
      38.8,
      47.7,
    );
  }
  if (buildingId === "gym") {
    const gymRooms: Record<string, [number, number, number, number]> = {
      stage: [15.0, 20.0, 70.0, 38.0],
      cr: [16.0, 69.0, 16.0, 18.0],
      dmst: [32.0, 69.0, 18.0, 18.0],
      osd: [50.0, 69.0, 18.0, 18.0],
      fitting: [68.0, 69.0, 16.0, 18.0],
    };
    const rect = gymRooms[roomId];
    return rect ? hotspotRect(rect[0], rect[1], rect[2], rect[3]) : null;
  }
  if (
    buildingId === "old" &&
    floorNumber === 2 &&
    (roomId === "cl-n" || roomId === "cl-s")
  ) {
    return rotateOldRect(
      roomId === "cl-n"
        ? { x: 52, y: 326, w: 130, h: 105 }
        : { x: 52, y: 955, w: 130, h: 108 },
    );
  }
  if (buildingId === "old" && floorNumber === 2) {
    const rooms: Record<string, Rect> = {
      "function-ext": { x: 20, y: 615, w: 32, h: 150 },
      function: { x: 52, y: 440, w: 200, h: 325 },
      faculty: { x: 509, y: 326, w: 84, h: 250 },
      library: { x: 660, y: 326, w: 87, h: 410 },
      stock1: { x: 686, y: 738, w: 61, h: 58 },
      stock2: { x: 686, y: 802, w: 61, h: 56 },
      classroom: { x: 686, y: 863, w: 61, h: 100 },
      org: { x: 576, y: 964, w: 171, h: 100 },
    };
    const rect = rooms[roomId];
    return rect ? rotateOldRect(rect) : null;
  }
  if (buildingId === "old" && floorNumber === 1) {
    const rooms: Record<string, Rect> = {
      chemistry: { x: 181, y: 280, w: 97, h: 115 },
      health: { x: 280, y: 280, w: 102, h: 115 },
      biology: { x: 385, y: 280, w: 102, h: 115 },
      clinic: { x: 552, y: 280, w: 71, h: 110 },
      "student-gov": { x: 647, y: 389, w: 88, h: 58 },
      "stock-a": { x: 40, y: 730, w: 89, h: 57 },
      "stock-b": { x: 40, y: 514, w: 89, h: 57 },
      "stock-c": { x: 131, y: 729, w: 52, h: 114 },
      "stock-d": { x: 130, y: 459, w: 51, h: 111 },
      "stock-e": { x: 633, y: 333, w: 102, h: 52 },
      "stock-f": { x: 633, y: 276, w: 102, h: 55 },
      "rm-119": { x: 182, y: 459, w: 99, h: 52 },
      "rm-118": { x: 182, y: 514, w: 99, h: 55 },
      "rm-115": { x: 339, y: 459, w: 101, h: 57 },
      "rm-114": { x: 339, y: 518, w: 101, h: 55 },
      tv: { x: 440, y: 459, w: 53, h: 114 },
      radio: { x: 440, y: 731, w: 53, h: 114 },
      "hm-lab": { x: 9, y: 584, w: 171, h: 126 },
      "rm-117": { x: 184, y: 730, w: 101, h: 57 },
      "rm-116": { x: 184, y: 790, w: 101, h: 54 },
      "rm-112": { x: 339, y: 731, w: 101, h: 57 },
      "rm-113": { x: 339, y: 790, w: 101, h: 54 },
      "rm-107": { x: 181, y: 907, w: 53, h: 112 },
      "rm-106": { x: 237, y: 907, w: 53, h: 112 },
      "rm-105": { x: 293, y: 907, w: 96, h: 112 },
      "faculty-1f": { x: 392, y: 907, w: 104, h: 112 },
      "cr-a": { x: 495, y: 971, w: 59, h: 47 },
      "cr-b": { x: 519, y: 909, w: 36, h: 59 },
      "cr-c": { x: 491, y: 280, w: 59, h: 62 },
      ms: { x: 555, y: 390, w: 73, h: 58 },
      ocd: { x: 620, y: 495, w: 31, h: 39 },
      security: { x: 620, y: 765, w: 31, h: 42 },
      conference: { x: 558, y: 852, w: 74, h: 167 },
      supply: { x: 637, y: 894, w: 52, h: 125 },
      multimedia: { x: 692, y: 852, w: 43, h: 167 },
    };
    const rect = rooms[roomId];
    return rect ? rotateOldRect(rect) : null;
  }
  return null;
}

function shortName(name: string): string {
  return name.replace(/ \((New|Old) Building\)$/, "");
}

function scaleOldRect(rect: Rect): Rect {
  return {
    x: (rect.x / 8000) * 1365,
    y: (rect.y / 4500) * 768,
    w: (rect.w / 8000) * 1365,
    h: (rect.h / 4500) * 768,
  };
}

function nodePoint(buildingId: BuildingId, x: number, y: number): Pt {
  if (buildingId === "old") {
    return { x: (x / 8000) * 1365, y: (y / 4500) * 768 };
  }
  if (buildingId === "new") return planPoint(x, y);
  return { x, y };
}

function isSelectableNode(id: string): boolean {
  const n = nodeById.get(id);
  return !!n && (n.kind === "entrance" || n.kind === "gate");
}

export function buildSelectGroups(names: Record<string, string> = {}) {
  const groups: { label: string; options: { id: string; name: string }[] }[] = [];
  const outdoor = campusGraph.nodes.filter(
    (n) =>
      !buildingOfNode(n.id) && (n.kind === "entrance" || n.kind === "gate"),
  );
  groups.push({
    label: "Campus",
    options: outdoor.map((n) => ({
      id: n.id,
      name: displayName(names, n.id, n.name),
    })),
  });
  buildings.forEach((b) => {
    b.floors.forEach((f) => {
      const options = campusGraph.nodes
        .filter(
          (n) =>
            buildingOfNode(n.id) === b.id &&
            n.floor === f.floor &&
            (n.kind === "entrance" || n.kind === "gate"),
        )
        .map((n) => ({ id: n.id, name: displayName(names, n.id, shortName(n.name)) }));
      if (options.length > 0) {
        groups.push({
          label: `${buildingDisplayName(names, b.id, b.name)}, ${floorDisplayName(names, b.id, f.floor, f.name)}`,
          options,
        });
      }
    });
  });
  return groups;
}

export const selectGroups = buildSelectGroups();

function zoomTransform(id: BuildingId): string {
  const r = buildingById[id].rect;
  const k = Math.min(
    CAMPUS_VIEWBOX.w / (r.w * 1.35),
    CAMPUS_VIEWBOX.h / (r.h * 1.35),
    3,
  );
  const cx = (r.x + r.w / 2) / CAMPUS_VIEWBOX.w;
  const cy = (r.y + r.h / 2) / CAMPUS_VIEWBOX.h;
  return `translate(${-k * (cx - 0.5) * 100}%, ${
    -k * (cy - 0.5) * 100
  }%) scale(${k})`;
}

function Pin({
  x,
  y,
  color,
  label,
  scale,
  pulse,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  scale: number;
  pulse?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className={pulse ? styles.pinPulse : undefined}
      pointerEvents="none"
    >
      <path
        d="M0 0 C -3 -7 -10 -12 -10 -20 A 10 10 0 1 1 10 -20 C 10 -12 3 -7 0 0 Z"
        fill={color}
        stroke="#ffffff"
        strokeWidth={1.6}
      />
      <text
        y={-16.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#ffffff"
      >
        {label}
      </text>
    </g>
  );
}

export type MapFocus =
  | { kind: "campus" }
  | { kind: "building"; id: BuildingId; floor?: number };

export interface RouteSummary {
  distance: number;
  legs: { label: string }[];
}

interface CampusMapProps {
  start?: string | null;
  dest?: string | null;
  onStartChange?: (id: string | null) => void;
  onDestChange?: (id: string | null) => void;
  hideSidebar?: boolean;
  focus?: (MapFocus & { nonce: number }) | null;
  onViewChange?: (view: "campus" | BuildingId) => void;
  onRoute?: (route: RouteSummary | null) => void;
  quickRoute?: boolean;
  onSelect?: (id: string | null) => void;
  onNamesChange?: (names: Record<string, string>) => void;
  userPos?: { x: number; y: number } | null;
  showNodes?: boolean;
}

export default function CampusMap({
  start,
  dest,
  onStartChange,
  onDestChange,
  hideSidebar = false,
  focus,
  onViewChange,
  onRoute,
  quickRoute = false,
  onSelect,
  onNamesChange,
  userPos,
  showNodes = false,
}: CampusMapProps = {}) {
  const mobileUi = useMobileUi();
  const [phase, setPhase] = useState<Phase>("campus");
  const [zoomed, setZoomed] = useState(false);
  const [buildingId, setBuildingId] = useState<BuildingId>("new");
  const [floor, setFloor] = useState(1);
  const [startState, setStartState] = useState<string | null>(null);
  const [destState, setDestState] = useState<string | null>(null);
  const startId = start !== undefined ? start : startState;
  const destId = dest !== undefined ? dest : destState;
  const setStartId = onStartChange ?? setStartState;
  const setDestId = onDestChange ?? setDestState;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [managedItems, setManagedItems] = useState<AdminNameItem[]>([]);
  const [selectedManagedId, setSelectedManagedId] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomEditingMode, setRoomEditingMode] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [editingRoomOriginalName, setEditingRoomOriginalName] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
  const [builderMode, setBuilderMode] = useState(false);
  const [builderPoints, setBuilderPoints] = useState<BuilderPoint[]>([]);
  const [builderCursor, setBuilderCursor] = useState<
    (BuilderCoordinates & { mapKey: string }) | null
  >(null);
  const appliedFocus = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const enterBuilding = useCallback(
    (id: BuildingId, targetFloor = 1) => {
      clearTimers();
      setBuildingId(id);
      setFloor(targetFloor);
      setPhase("in");
      after(40, () => setZoomed(true));
      after(760, () => setPhase("building"));
    },
    [after, clearTimers],
  );

  const backToCampus = useCallback(() => {
    clearTimers();
    setPhase("out");
    after(40, () => setZoomed(false));
    after(760, () => setPhase("campus"));
  }, [after, clearTimers]);

  const showLocation = useCallback(
    (id: BuildingId | null, targetFloor?: number) => {
      if (id === null) {
        if (phase === "building") backToCampus();
        return;
      }
      if (phase === "building") {
        setBuildingId(id);
        setFloor(targetFloor ?? 1);
      } else if (phase === "campus") {
        enterBuilding(id, targetFloor ?? 1);
      }
    },
    [backToCampus, enterBuilding, phase],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "building") backToCampus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, backToCampus]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teacher/session")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setIsAdmin(data.admin === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    fetch("/api/rooms/claim")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.reservations)) return;
        const next: Record<string, string> = {};
        data.reservations.forEach(
          (r: { nodeId: string; professor: string }) => {
            next[r.nodeId] = r.professor;
          },
        );
        setClaims(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/names")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.names && typeof data.names === "object") setRoomNames(data.names);
        if (Array.isArray(data.items)) setManagedItems(data.items);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin]);

  const clearPins = useCallback(() => {
    setStartId(null);
    setDestId(null);
    setSelectedId(null);
  }, [setStartId, setDestId, setSelectedId]);

  const swapPins = useCallback(() => {
    setStartId(destId);
    setDestId(startId);
  }, [destId, startId, setStartId, setDestId]);

  const route = useMemo(() => {
    if (!startId || !destId) return null;
    if (!nodeById.has(startId) || !nodeById.has(destId)) return null;
    const startBuilding = buildingOfNode(startId);
    const destinationBuilding = buildingOfNode(destId);
    const sameBuilding =
      startBuilding !== null && startBuilding === destinationBuilding;
    const graph = sameBuilding
      ? {
          nodes: routingGraph.nodes.filter(
            (node) => buildingOfNode(node.id) === startBuilding,
          ),
          edges: routingGraph.edges.filter(
            (edge) =>
              buildingOfNode(edge.from) === startBuilding &&
              buildingOfNode(edge.to) === startBuilding,
          ),
        }
      : routingGraph;
    return findShortestPath(graph, startId, destId);
  }, [startId, destId]);

  const routeIds = useMemo(() => route?.path ?? [], [route]);

  const legs = useMemo(() => {
    const result: {
      key: string;
      label: string;
      building: BuildingId | null;
      floor: number | null;
    }[] = [];
    routeIds.forEach((id) => {
      const n = nodeById.get(id);
      if (!n) return;
      const b = buildingOfNode(id);
      const key = b ? `${b}:${n.floor}` : "outside";
      if (result.length > 0 && result[result.length - 1].key === key) return;
      let label = "Walk outdoors";
      if (b) {
        const plan = buildingById[b].floors.find((f) => f.floor === n.floor);
        label = `${buildingDisplayName(roomNames, b, buildingById[b].name)}, ${floorDisplayName(roomNames, b, n.floor ?? 1, plan?.name ?? `Floor ${n.floor}`)}`;
      }
      result.push({
        key,
        label,
        building: b,
        floor: b ? n.floor ?? 1 : null,
      });
    });
    return result;
  }, [routeIds, roomNames]);

  const campusRoute = useMemo(() => {
    const startBuilding = startId ? buildingOfNode(startId) : null;
    const destinationBuilding = destId ? buildingOfNode(destId) : null;
    if (startBuilding !== null && startBuilding === destinationBuilding) {
      return [];
    }

    const pts: Pt[] = [];
    let lastLocationKey: string | null = null;
    const push = (key: string, p: Pt) => {
      const last = pts[pts.length - 1];
      if (
        !last ||
        lastLocationKey !== key ||
        last.x !== p.x ||
        last.y !== p.y
      ) {
        pts.push(p);
        lastLocationKey = key;
      }
    };
    routeIds.forEach((id) => {
      const n = nodeById.get(id);
      if (!n) return;
      const b = buildingOfNode(id);
      if (b) {
        push(`building:${b}`, buildingById[b].door);
      } else {
        push(`outside:${id}`, { x: n.x, y: n.y });
      }
    });
    return pts;
  }, [routeIds, startId, destId]);

  const indoorRoute = useMemo(() => {
    const lines: Pt[][] = [];
    let current: Pt[] = [];
    routeIds.forEach((id) => {
      const n = nodeById.get(id);
      const matches =
        !!n && buildingOfNode(id) === buildingId && n.floor === floor;
      if (matches && n) {
        current.push(nodePoint(buildingId, n.x, n.y));
      } else if (current.length > 0) {
        lines.push(current);
        current = [];
      }
    });
    if (current.length > 0) lines.push(current);
    return lines;
  }, [routeIds, buildingId, floor]);

  const indoorWalkableEdges = useMemo(() => {
    const alwaysShow = buildingId !== "old" && buildingId !== "new";
    if (!showNodes && !alwaysShow) return [];
    const isOldNet = (id: string) =>
      id.startsWith("OB-1-P") || id.startsWith("OB-1-D");
    return routingGraph.edges.flatMap((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return [];
      if (
        buildingOfNode(edge.from) !== buildingId ||
        buildingOfNode(edge.to) !== buildingId
      ) {
        return [];
      }
      if (from.floor !== floor || to.floor !== floor) return [];
      if (buildingId === "old" && !(isOldNet(edge.from) && isOldNet(edge.to))) {
        return [];
      }
      return [
        {
          key: `${edge.from}-${edge.to}`,
          fromPoint: nodePoint(buildingId, from.x, from.y),
          toPoint: nodePoint(buildingId, to.x, to.y),
        },
      ];
    });
  }, [buildingId, floor, showNodes]);

  useEffect(() => {
    if (!focus || appliedFocus.current === focus.nonce) return;
    appliedFocus.current = focus.nonce;
    const timer = setTimeout(() => {
      if (focus.kind === "campus") {
        clearTimers();
        setZoomed(false);
        setPhase("campus");
      } else {
        clearTimers();
        setBuildingId(focus.id);
        setFloor(focus.floor ?? 1);
        setPhase("in");
        setZoomed(true);
        after(760, () => setPhase("building"));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [focus, phase, after, clearTimers]);

  useEffect(() => {
    onViewChange?.(
      phase === "building" || phase === "in" ? buildingId : "campus",
    );
  }, [phase, buildingId, onViewChange]);

  useEffect(() => {
    onRoute?.(
      route
        ? {
            distance: route.distance,
            legs: legs.map((l) => ({ label: l.label })),
          }
        : null,
    );
  }, [route, legs, onRoute]);

  const hasPins = !!startId || !!destId;
  const building = buildingById[buildingId];
  const plan =
    building.floors.find((f) => f.floor === floor) ?? building.floors[0];
  const indoorImage =
    phase === "building" || phase === "out"
      ? indoorImages[
          buildingId === "ctmo" ||
          buildingId === "cl-n" ||
          buildingId === "cl-s"
            ? buildingId
            : `${buildingId}-${floor}`
        ]
      : null;

  const pinKind = (id: string | undefined) =>
    id && id === startId ? "start" : id && id === destId ? "dest" : null;

  const pinPosCampus = (id: string): Pt | null => {
    const n = nodeById.get(id);
    if (!n) return null;
    const clExit = clExitForNode(id);
    if (clExit) return clExit;
    const b = buildingOfNode(id);
    if (b) {
      const r = buildingById[b].rect;
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    return { x: n.x, y: n.y };
  };

  const pick = (id: string) => {
    setSelectedId(id);
    if (!quickRoute) return;
    if (!startId) setStartId(id);
    else if (!destId) {
      if (id !== startId) setDestId(id);
    } else {
      setStartId(id);
      setDestId(null);
    }
  };

  const selectManagedLocation = (
    id: string,
    fallbackName: string,
    location?: {
      buildingId?: BuildingId;
      floor?: number;
      nodeId?: string;
      kind?: AdminNameItem["kind"];
    },
  ) => {
    if (!isAdmin || !roomEditingMode) return;
    const current = managedItems.find((item) => item.id === id);
    const name = roomNames[id] ?? current?.name ?? fallbackName;
    if (
      editingRoomId &&
      editingRoomId !== id &&
      editingRoomName !== editingRoomOriginalName &&
      !window.confirm("Discard unsaved name changes?")
    ) return;

    setSelectedManagedId(id);
    setEditingRoomId(id);
    setEditingRoomName(name);
    setEditingRoomOriginalName(name);
    setRoomNameError("");

    const buildingTarget = location?.buildingId ?? current?.buildingId;
    const floorTarget = location?.floor ?? current?.floor;
    if (location?.kind === "building" || current?.kind === "building") {
      setSelectedId(null);
      if (phase !== "campus") backToCampus();
      return;
    }
    if (buildingTarget) {
      setSelectedId(location?.nodeId ?? current?.nodeId ?? null);
      if (phase === "campus" || phase === "out" || phase === "in") {
        enterBuilding(buildingTarget, floorTarget ?? 1);
      } else {
        setBuildingId(buildingTarget);
        setFloor(floorTarget ?? 1);
      }
    } else {
      setSelectedId(location?.nodeId ?? current?.nodeId ?? id);
    }
  };

  const selectManagedItem = (item: AdminNameItem) => {
    selectManagedLocation(item.id, item.name, {
      buildingId: item.buildingId,
      floor: item.floor,
      nodeId: item.nodeId,
      kind: item.kind,
    });
  };

  const onShapeClick = (shape: CampusShape) => {
    if (builderMode) return;
    if (phase !== "campus") return;
    if (isAdmin && roomEditingMode) {
      if (shape.buildingId) {
        const buildingData = buildings.find((candidate) => candidate.id === shape.buildingId);
        const matchingRoomId = shape.id === "gym-stage" ? "stage" : shape.id;
        const match = buildingData?.floors
          .map((candidate) => ({ floor: candidate.floor, room: candidate.rooms.find((room) => room.id === matchingRoomId) }))
          .find((entry) => !!entry.room);
        if (match?.room) {
          const id = match.room.nodeId ?? syntheticRoomNameKey(shape.buildingId, match.floor, match.room.id);
          selectManagedLocation(id, shape.label.replace(/\n/g, " "), {
            buildingId: shape.buildingId,
            floor: match.floor,
            nodeId: match.room.nodeId,
            kind: "room",
          });
        } else {
          const fallback = buildingData?.name ?? shape.label;
          selectManagedLocation(buildingNameKey(shape.buildingId), fallback, {
            buildingId: shape.buildingId,
            kind: "building",
          });
        }
      } else {
        const representedBuilding = buildings.find((candidate) => candidate.id === shape.id);
        if (representedBuilding) {
          selectManagedLocation(buildingNameKey(representedBuilding.id), representedBuilding.name, {
            buildingId: representedBuilding.id,
            kind: "building",
          });
        } else if (shape.nodeId) {
          selectManagedLocation(shape.nodeId, shape.label, { nodeId: shape.nodeId, kind: "area" });
        }
      }
      return;
    }
    if (shape.buildingId) {
      enterBuilding(shape.buildingId);
      return;
    }
    if (shape.nodeId) pick(shape.nodeId);
  };

  const selectNode = (id: string) => {
    if (isSelectableNode(id)) pick(id);
  };

  const cancelRoomNameEdit = useCallback(() => {
    setEditingRoomId(null);
    setEditingRoomName("");
    setEditingRoomOriginalName("");
    setRoomNameError("");
  }, []);

  const exitRoomEditingMode = useCallback((): boolean => {
    if (
      editingRoomName !== editingRoomOriginalName &&
      editingRoomId &&
      !window.confirm("You have unsaved room name changes. Leave editing mode?")
    ) {
      return false;
    }
    cancelRoomNameEdit();
    setRoomEditingMode(false);
    return true;
  }, [
    cancelRoomNameEdit,
    editingRoomId,
    editingRoomName,
    editingRoomOriginalName,
  ]);

  useEffect(() => {
    if (!roomEditingMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      exitRoomEditingMode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roomEditingMode, exitRoomEditingMode]);

  const saveRoomNameEdit = async () => {
    if (!isAdmin || !editingRoomId || nameSaving) return;
    const name = editingRoomName.trim();
    if (!name) return setRoomNameError("Name cannot be empty.");
    if (name.length > 100) return setRoomNameError("Names must be 100 characters or fewer.");
    setNameSaving(true);
    setRoomNameError("");
    try {
      const response = await fetch("/api/admin/names", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingRoomId, name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRoomNameError(data.error ?? "Could not save this name.");
        return;
      }
      const updatedNames =
        data.names && typeof data.names === "object"
          ? data.names as Record<string, string>
          : { ...roomNames, [editingRoomId]: name };
      setRoomNames(updatedNames);
      onNamesChange?.(updatedNames);
      if (Array.isArray(data.items)) setManagedItems(data.items);
      setEditingRoomName(name);
      setEditingRoomOriginalName(name);
    } catch {
      setRoomNameError("Could not reach the server. Please try again.");
    } finally {
      setNameSaving(false);
    }
  };

  useEffect(() => {
    onSelect?.(selectedId);
  }, [selectedId, onSelect]);

  const vb = planViewBox(plan.bounds);
  const indoorViewBox = indoorImage
    ? {
        x: 0,
        y: 0,
        w: indoorImage.rotate ? indoorImage.height : indoorImage.width,
        h: indoorImage.rotate ? indoorImage.width : indoorImage.height,
      }
    : vb;
  const campusViewBox = { x: 0, y: 0, ...CAMPUS_VIEWBOX };
  const activeViewBox = phase === "campus" ? campusViewBox : indoorViewBox;
  const activeMapKey = phase === "campus" ? "campus" : `${buildingId}-${floor}`;

  const builderCoordinatesFromEvent = (
    event: ReactMouseEvent<SVGSVGElement>,
    viewBox: Rect,
  ): BuilderCoordinates | null => {
    const matrix = event.currentTarget.getScreenCTM();
    let displayX: number;
    let displayY: number;
    if (matrix) {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      displayX = point.x;
      displayY = point.y;
    } else {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return null;
      const scale = Math.min(
        bounds.width / viewBox.w,
        bounds.height / viewBox.h,
      );
      const offsetX = (bounds.width - viewBox.w * scale) / 2;
      const offsetY = (bounds.height - viewBox.h * scale) / 2;
      displayX = viewBox.x + (event.clientX - bounds.left - offsetX) / scale;
      displayY = viewBox.y + (event.clientY - bounds.top - offsetY) / scale;
    }
    return {
      x: Number(displayX.toFixed(1)),
      y: Number(displayY.toFixed(1)),
      displayX: Number(displayX.toFixed(1)),
      displayY: Number(displayY.toFixed(1)),
    };
  };

  const updateBuilderCursor = (
    event: ReactMouseEvent<SVGSVGElement>,
    mapKey: string,
    viewBox: Rect,
  ) => {
    if (!builderMode) return;
    const coordinates = builderCoordinatesFromEvent(event, viewBox);
    if (!coordinates) return;
    setBuilderCursor({ mapKey, ...coordinates });
  };

  const addBuilderPoint = (
    event: ReactMouseEvent<SVGSVGElement>,
    mapKey: string,
    viewBox: Rect,
  ) => {
    if (!builderMode) return;
    const coordinates = builderCoordinatesFromEvent(event, viewBox);
    if (!coordinates) return;
    setBuilderPoints((points) => [
      ...points,
      {
        id: points.length + 1,
        mapKey,
        label: phase === "campus" ? "Campus" : `${currentBuildingName}, ${currentFloorName}`,
        ...coordinates,
      },
    ]);
  };

  const builderText = builderPoints
    .map(
      (point) =>
        `${point.id}. ${point.label}: x: ${point.x}, y: ${point.y}` +
        (point.mapKey.startsWith("old-")
          ? ` (display x: ${point.displayX}, y: ${point.displayY})`
          : ""),
    )
    .join("\n");
  const currentBuildingName = buildingDisplayName(roomNames, buildingId, building.name);
  const currentFloorName = floorDisplayName(roomNames, buildingId, floor, plan.name);
  const phaseLabel =
    phase === "building" || phase === "out" || phase === "in"
      ? `${currentBuildingName}, ${currentFloorName}`
      : "Campus overview";
  const visibleManagedItems = managedItems.filter((item) =>
    `${item.name} ${item.context} ${item.id}`.toLowerCase().includes(nameSearch.trim().toLowerCase()),
  );
  const selectedManagedItem = managedItems.find((item) => item.id === selectedManagedId);
  const locationSelectGroups = useMemo(() => buildSelectGroups(roomNames), [roomNames]);

  return (
    <div className={styles.root}>
      {(process.env.NODE_ENV !== "production" || isAdmin) && (
        <section className={styles.builderPanel} aria-label="Node builder">
          <div className={styles.builderActions}>
            <button
              type="button"
              className={styles.builderButton}
              aria-pressed={builderMode}
              onClick={() => setBuilderMode((active) => !active)}
            >
              {builderMode ? "Stop node builder" : "Build map nodes"}
            </button>
            {builderMode && (
              <span className={styles.builderHint}>
                Move the cursor to preview coordinates, then click once per
                node.
              </span>
            )}
            {builderMode && builderCursor && (
              <span className={styles.builderCursor}>
                Cursor: x {builderCursor.x}, y {builderCursor.y}
              </span>
            )}
            {builderPoints.length > 0 && (
              <button
                type="button"
                className={styles.builderClear}
                onClick={() => setBuilderPoints([])}
              >
                Clear coordinates
              </button>
            )}
          </div>
          {builderPoints.length > 0 && (
            <pre className={styles.builderOutput} aria-live="polite">
              {builderText}
            </pre>
          )}
        </section>
      )}
      <div
        className={`${styles.layout} ${hideSidebar ? styles.noSidebar : ""} ${isAdmin && roomEditingMode ? styles.layoutWithEditor : ""}`}
      >
        {isAdmin && roomEditingMode && (
          <aside className={styles.adminEditor} aria-label="Location name editor">
            <div className={styles.editorHeader}>
              <div>
                <strong>Manage map names</strong>
                <span>Buildings, floors, rooms and campus areas</span>
              </div>
              <button
                type="button"
                className={styles.editorClose}
                onClick={() => exitRoomEditingMode()}
                aria-label="Close name editor"
                title="Close name editor"
              >
                ×
              </button>
            </div>
            <input
              className={styles.editorSearch}
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
              placeholder="Search locations…"
              aria-label="Search locations"
            />
            <div className={styles.editorList} role="listbox" aria-label="Available locations">
              {visibleManagedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selectedManagedId === item.id}
                  className={`${styles.editorItem} ${selectedManagedId === item.id ? styles.editorItemActive : ""}`}
                  onClick={() => selectManagedItem(item)}
                  disabled={nameSaving}
                >
                  <span className={styles.editorItemTop}>
                    <span className={styles.editorKind}>{item.kind}</span>
                    <span className={styles.editorItemName}>{item.name}</span>
                  </span>
                  <span className={styles.editorContext}>{item.context}</span>
                </button>
              ))}
              {visibleManagedItems.length === 0 && (
                <p className={styles.editorEmpty}>No matching locations.</p>
              )}
            </div>
            <div className={styles.editorForm}>
              <div className={styles.editorFormHeading}>
                <strong>{selectedManagedItem ? "Edit selected name" : "Select a location"}</strong>
                {selectedManagedItem && <span>{selectedManagedItem.kind}</span>}
              </div>
              <label className={styles.editorLabel} htmlFor="atlas-managed-name">
                Current name
              </label>
              <input
                id="atlas-managed-name"
                className={styles.editorInput}
                value={editingRoomId ? editingRoomName : ""}
                onChange={(event) => setEditingRoomName(event.target.value)}
                disabled={!editingRoomId || nameSaving}
                maxLength={100}
                placeholder="Select a building, floor or room above"
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveRoomNameEdit();
                  if (event.key === "Escape") {
                    const savedName = selectedManagedId
                      ? roomNames[selectedManagedId] ?? selectedManagedItem?.name ?? ""
                      : "";
                    setEditingRoomName(savedName);
                    setEditingRoomOriginalName(savedName);
                    setRoomNameError("");
                  }
                }}
              />
              <div className={styles.editorButtons}>
                <button
                  type="button"
                  className={styles.editorSave}
                  onClick={saveRoomNameEdit}
                  disabled={!editingRoomId || nameSaving || !editingRoomName.trim() || editingRoomName.trim() === editingRoomOriginalName}
                >
                  {nameSaving ? "Saving…" : "Save name"}
                </button>
                <button
                  type="button"
                  className={styles.editorCancel}
                  disabled={!editingRoomId || nameSaving}
                  onClick={() => {
                    const savedName = selectedManagedId
                      ? roomNames[selectedManagedId] ?? selectedManagedItem?.name ?? ""
                      : "";
                    setEditingRoomName(savedName);
                    setEditingRoomOriginalName(savedName);
                    setRoomNameError("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {roomNameError && <p className={styles.editorError} role="alert">{roomNameError}</p>}
              <p className={styles.editorHint}>Selecting an item also highlights its location on the map.</p>
            </div>
          </aside>
        )}
        <div className={styles.stage}>
          <div className={styles.chip} aria-live="polite">
            {phaseLabel}
          </div>

          <ZoomPan
            enabled={mobileUi}
            resetKey={`${
              phase === "campus" ? "c" : "b"
            }-${buildingId}-${floor}`}
          >
            <div
              className={`${styles.campusLayer} ${
                phase === "out" ? styles.fast : ""
              }`}
              style={{
                transform: zoomed ? zoomTransform(buildingId) : "none",
                opacity: zoomed ? 0 : 1,
                pointerEvents: phase === "campus" ? "auto" : "none",
              }}
            >
              <svg
                viewBox={`0 0 ${CAMPUS_VIEWBOX.w} ${CAMPUS_VIEWBOX.h}`}
                className={styles.svg}
                role="img"
                aria-label="Campus map"
                onClick={(event) =>
                  addBuilderPoint(event, "campus", {
                    x: 0,
                    y: 0,
                    ...CAMPUS_VIEWBOX,
                  })
                }
                onMouseMove={(event) =>
                  updateBuilderCursor(event, "campus", {
                    x: 0,
                    y: 0,
                    ...CAMPUS_VIEWBOX,
                  })
                }
                onMouseLeave={() => setBuilderCursor(null)}
              >
                <image
                  href={campusMap01.src}
                  x="0"
                  y="0"
                  width={CAMPUS_VIEWBOX.w}
                  height={CAMPUS_VIEWBOX.h}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
                {outdoorEdges.map((e) => {
                  const a = nodeById.get(e.from);
                  const b = nodeById.get(e.to);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={`${e.from}-${e.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={styles.walkway}
                    />
                  );
                })}

                {campusShapes.map((s) => {
                  const representedBuildingId = s.buildingId ?? buildings.find((candidate) => candidate.id === s.id)?.id;
                  const buildingData = representedBuildingId
                    ? buildings.find((candidate) => candidate.id === representedBuildingId)
                    : undefined;
                  const matchingRoomId = s.id === "gym-stage" ? "stage" : s.id;
                  const matchingRoom = buildingData?.floors
                    .map((candidate) => ({ floor: candidate.floor, room: candidate.rooms.find((room) => room.id === matchingRoomId) }))
                    .find((entry) => !!entry.room);
                  const shapeRoomKey = matchingRoom?.room && representedBuildingId
                    ? matchingRoom.room.nodeId ?? syntheticRoomNameKey(representedBuildingId, matchingRoom.floor, matchingRoom.room.id)
                    : undefined;
                  const shapeManagedId = shapeRoomKey ?? (representedBuildingId ? buildingNameKey(representedBuildingId) : s.nodeId);
                  const shapeName = shapeRoomKey && matchingRoom?.room
                    ? displayName(roomNames, shapeRoomKey, s.label)
                    : representedBuildingId
                    ? displayName(roomNames, buildingNameKey(representedBuildingId), s.label)
                    : displayName(roomNames, s.nodeId, s.label);
                  const shapeHasOverride = !!(shapeManagedId && roomNames[shapeManagedId]);
                  const shapeClipId = `campus-label-${s.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
                  const shapeLabelLayout = fitMapLabel(
                    shapeName,
                    s.vertical ? s.h : s.w,
                    s.vertical ? s.w : s.h,
                  );
                  const kind = pinKind(s.nodeId);
                  const selectable = !!s.nodeId || !!s.buildingId;
                  const cls = [
                    styles.shape,
                    styles[`tone_${s.tone}`],
                    selectable ? styles.hoverable : "",
                    (selectedId && selectedId === s.nodeId) ||
                    (roomEditingMode && shapeManagedId && selectedManagedId === shapeManagedId)
                      ? styles.isSelected
                      : "",
                    kind === "start" ? styles.isStart : "",
                    kind === "dest" ? styles.isDest : "",
                  ].join(" ");
                  const cx = s.x + s.w / 2;
                  const cy = s.y + s.h / 2;
                  return (
                    <g
                      key={s.id}
                      onClick={() => onShapeClick(s)}
                      role={selectable ? "button" : undefined}
                      tabIndex={selectable ? 0 : undefined}
                      aria-label={selectable ? `${shapeName}, select` : undefined}
                      onKeyDown={(e) => {
                        if (
                          selectable &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          onShapeClick(s);
                        }
                      }}
                    >
                      <rect
                        x={s.x}
                        y={s.y}
                        width={s.w}
                        height={s.h}
                        rx={3}
                        className={campusMap01
                          ? styles.imageHitbox + " " + (
                              (roomEditingMode && selectedManagedId === (shapeManagedId ?? "")) ||
                              (selectedId && selectedId === s.nodeId)
                                ? styles.isSelected
                                : ""
                            )
                          : cls}
                      />
                      <defs>
                        <clipPath id={shapeClipId} clipPathUnits="userSpaceOnUse">
                          <rect
                            x={s.x + 4}
                            y={s.y + 4}
                            width={Math.max(1, s.w - 8)}
                            height={Math.max(1, s.h - 8)}
                          />
                        </clipPath>
                      </defs>
                      <text
                        clipPath={`url(#${shapeClipId})`}
                        x={cx}
                        y={cy}
                        className={
                          campusMap01 && !shapeHasOverride
                            ? styles.imageLabelHidden
                            : styles.label
                        }
                        fontSize={shapeLabelLayout.fontSize}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={
                          s.vertical ? `rotate(-90 ${cx} ${cy})` : undefined
                        }
                      >
                        {shapeLabelLayout.lines.map((line, index) => (
                          <tspan
                            key={index}
                            x={cx}
                            dy={index === 0
                              ? -((shapeLabelLayout.lines.length - 1) * shapeLabelLayout.fontSize * 0.58)
                              : shapeLabelLayout.fontSize * 1.16}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                      <title>{shapeName}</title>
                    </g>
                  );
                })}

                {buildings
                  .filter((b) => b.id === "old" || b.id === "new")
                  .map((b) => {
                    const cx = b.rect.x + b.rect.w / 2;
                    const cy = b.rect.y + b.rect.h / 2;
                    const buildingLabel = buildingDisplayName(roomNames, b.id, b.name);
                    const buildingClipId = `building-label-${b.id}`;
                    const buildingLabelLayout = fitMapLabel(buildingLabel, b.rect.h, b.rect.w);
                    const hitRects =
                      b.id === "old"
                        ? [
                            { x: 2380, y: 2508, w: 3412, h: 736 },
                            { x: 2868, y: 3244, w: 2432, h: 488 },
                          ]
                        : [b.rect];
                    return (
                      <g
                        key={b.id}
                        onClick={() => {
                          if (builderMode || phase !== "campus") return;
                          if (isAdmin && roomEditingMode) {
                            selectManagedLocation(buildingNameKey(b.id), buildingDisplayName(roomNames, b.id, b.name), {
                              buildingId: b.id,
                              kind: "building",
                            });
                          } else {
                            enterBuilding(b.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${buildingDisplayName(roomNames, b.id, b.name)}, open floor plans`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (phase === "campus") {
                              if (isAdmin && roomEditingMode) {
                                selectManagedLocation(buildingNameKey(b.id), buildingDisplayName(roomNames, b.id, b.name), {
                                  buildingId: b.id,
                                  kind: "building",
                                });
                              } else {
                                enterBuilding(b.id);
                              }
                            }
                          }
                        }}
                      >
                        {hitRects.map((rect, index) => (
                          <rect
                            key={`${b.id}-hitbox-${index}`}
                            x={rect.x}
                            y={rect.y}
                            width={rect.w}
                            height={rect.h}
                            rx={4}
                            className={`${styles.imageHitbox} ${roomEditingMode && selectedManagedId === buildingNameKey(b.id) ? styles.isSelected : ""}`}
                          />
                        ))}
                        <defs>
                          <clipPath id={buildingClipId} clipPathUnits="userSpaceOnUse">
                            <rect
                              x={b.rect.x + 4}
                              y={b.rect.y + 4}
                              width={Math.max(1, b.rect.w - 8)}
                              height={Math.max(1, b.rect.h - 8)}
                            />
                          </clipPath>
                        </defs>
                        <text
                          clipPath={`url(#${buildingClipId})`}
                          x={cx}
                          y={cy - 10}
                          className={roomNames[buildingNameKey(b.id)] ? styles.label : styles.imageLabelHidden}
                          fontSize={buildingLabelLayout.fontSize}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(-90 ${cx} ${cy - 10})`}
                        >
                          {buildingLabelLayout.lines.map((line, index) => (
                            <tspan
                              key={index}
                              x={cx}
                              dy={index === 0
                                ? -((buildingLabelLayout.lines.length - 1) * buildingLabelLayout.fontSize * 0.58)
                                : buildingLabelLayout.fontSize * 1.16}
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                        <text
                          x={cx}
                          y={b.rect.y + b.rect.h - 14}
                          className={styles.imageLabelHidden}
                          fontSize={8}
                          textAnchor="middle"
                        >
                          Tap to enter
                        </text>
                        <title>{`${buildingDisplayName(roomNames, b.id, b.name)}: click to see the floor plans`}</title>
                      </g>
                    );
                  })}

                {campusRoute.length > 1 && (
                  <polyline
                    points={campusRoute.map((p) => `${p.x},${p.y}`).join(" ")}
                    className={styles.route}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {(["cl-n", "cl-s"] as const).map((id) => {
                  const point = clExitPoints[id];
                  return (
                    <g
                      key={id}
                      className={styles.clExitMarker}
                      transform={`translate(${point.x} ${point.y})`}
                      pointerEvents="none"
                    >
                      <circle r={9} />
                      <text y={1.8} textAnchor="middle">
                        {id === "cl-s" ? "1–4" : "5–8"}
                      </text>
                      <title>
                        {id === "cl-s"
                          ? "Exit to CL Rooms 1–4"
                          : "Exit to CL Rooms 5–8"}
                      </title>
                    </g>
                  );
                })}

                {startId &&
                  (() => {
                    const p = pinPosCampus(startId);
                    return p ? (
                      <Pin
                        x={p.x}
                        y={p.y}
                        color="#16a34a"
                        label="A"
                        scale={mobileUi ? 14 : 1}
                      />
                    ) : null;
                  })()}
                {destId &&
                  (() => {
                    const p = pinPosCampus(destId);
                    return p ? (
                      <Pin
                        x={p.x}
                        y={p.y}
                        color="#dc2626"
                        label="B"
                        scale={mobileUi ? 14 : 1}
                        pulse
                      />
                    ) : null;
                  })()}

                {showNodes &&
                  routingGraph.nodes
                    .filter((n) => !buildingOfNode(n.id))
                    .map((n) => (
                      <circle
                        key={n.id}
                        cx={n.x}
                        cy={n.y}
                        r={1.4}
                        fill="#f43f5e"
                        pointerEvents="none"
                      />
                    ))}
                {userPos && (
                  <g pointerEvents="none">
                    <circle
                      cx={userPos.x}
                      cy={userPos.y}
                      r={14}
                      fill="#2563eb"
                      opacity={0.18}
                    />
                    <circle
                      cx={userPos.x}
                      cy={userPos.y}
                      r={6}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </g>
                )}
                {builderMode &&
                  builderPoints
                    .filter((point) => point.mapKey === "campus")
                    .map((point) => (
                      <g key={`builder-${point.id}`} pointerEvents="none">
                        <circle
                          cx={point.displayX}
                          cy={point.displayY}
                          r={4}
                          fill="#f97316"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        <text
                          x={point.displayX + 7}
                          y={point.displayY - 7}
                          className={styles.builderMarkerLabel}
                        >
                          {point.id}
                        </text>
                      </g>
                    ))}
              </svg>
            </div>

            {(phase === "building" || phase === "out") && (
              <div
                className={`${styles.indoorLayer} ${
                  phase === "out" ? styles.indoorExit : styles.indoorEnter
                }`}
              >
                <svg
                  viewBox={
                    indoorImage
                      ? `0 0 ${
                          indoorImage.rotate
                            ? indoorImage.height
                            : indoorImage.width
                        } ${
                          indoorImage.rotate
                            ? indoorImage.width
                            : indoorImage.height
                        }`
                      : `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
                  }
                  className={styles.svg}
                  role="img"
                  aria-label={`${currentBuildingName}, ${currentFloorName} floor plan`}
                  onClick={(event) =>
                    addBuilderPoint(event, activeMapKey, activeViewBox)
                  }
                  onMouseMove={(event) =>
                    updateBuilderCursor(event, activeMapKey, activeViewBox)
                  }
                  onMouseLeave={() => setBuilderCursor(null)}
                >
                  {indoorImage && (
                    <image
                      href={indoorImage.src}
                      x="0"
                      y="0"
                      width={indoorImage.width}
                      height={indoorImage.height}
                      transform={
                        indoorImage.rotate
                          ? `rotate(90) translate(0 ${-indoorImage.height})`
                          : undefined
                      }
                      preserveAspectRatio="none"
                      pointerEvents="none"
                    />
                  )}
                  {plan.open.map((o, i) => {
                    if (indoorImage) return null;
                    const r = planRect(o);
                    return (
                      <rect
                        key={i}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        rx={14}
                        className={styles.openArea}
                      />
                    );
                  })}

                  {plan.rooms.map((room: PlanRoom) => {
                    const r = indoorImage
                      ? buildingId === "old"
                        ? scaleOldRect(room)
                        : imageRoomRect(buildingId, floor, room.id)
                      : planRect(room);
                    if (!r) return null;
                    const managedRoomId = room.nodeId ?? syntheticRoomNameKey(buildingId, floor, room.id);
                    const displayRoomName = displayName(roomNames, managedRoomId, room.label);
                    const labelLayout = fitMapLabel(displayRoomName, r.w, r.h);
                    const lines = labelLayout.lines;
                    const fs = labelLayout.fontSize;
                    const roomClipId = `room-label-${buildingId}-${floor}-${room.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
                    const selectable =
                      roomEditingMode ||
                      (!!room.nodeId &&
                        (isSelectableNode(room.nodeId) || !!room.openBuildingId));
                    const kind = pinKind(room.nodeId);
                    const cls = [
                      indoorImage ? styles.imageHitbox : styles.room,
                      room.placeholder ? styles.placeholder : "",
                      selectable ? styles.hoverable : "",
                      room.nodeId && nodeById.get(room.nodeId)?.claimable
                        ? claims[room.nodeId]
                          ? styles.roomOccupied
                          : styles.roomAvailable
                        : "",
                      ((selectedId && selectedId === room.nodeId) ||
                        (roomEditingMode && selectedManagedId === managedRoomId))
                        ? styles.isSelected
                        : "",
                      kind === "start" ? styles.isStart : "",
                      kind === "dest" ? styles.isDest : "",
                    ].join(" ");
                    const cx = r.x + r.w / 2;
                    const cy = r.y + r.h / 2;
                    return (
                      <g
                        key={room.id}
                        onClick={() => {
                          if (builderMode) return;
                          if (isAdmin && roomEditingMode) {
                            selectManagedLocation(managedRoomId, displayRoomName, {
                              buildingId,
                              floor,
                              nodeId: room.nodeId,
                              kind: "room",
                            });
                            return;
                          }
                          if (room.openBuildingId) {
                            enterBuilding(
                              room.openBuildingId,
                              room.openFloor ?? 1,
                            );
                          } else if (room.nodeId) {
                            selectNode(room.nodeId);
                          }
                        }}
                        role={selectable ? "button" : undefined}
                        tabIndex={selectable ? 0 : undefined}
                        aria-label={
                          selectable
                            ? `${displayRoomName.replace("\n", " ")}, select`
                            : undefined
                        }
                        onKeyDown={(e) => {
                          if (
                            selectable &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            if (isAdmin && roomEditingMode) {
                              selectManagedLocation(managedRoomId, displayRoomName, {
                                buildingId,
                                floor,
                                nodeId: room.nodeId,
                                kind: "room",
                              });
                              return;
                            }
                            if (room.openBuildingId) {
                              enterBuilding(
                                room.openBuildingId,
                                room.openFloor ?? 1,
                              );
                            } else if (room.nodeId) {
                              selectNode(room.nodeId);
                            }
                          }
                        }}
                      >
                        <rect
                          x={r.x}
                          y={r.y}
                          width={r.w}
                          height={r.h}
                          rx={6}
                          className={cls}
                        />
                        <defs>
                          <clipPath id={roomClipId}>
                            <rect
                              x={r.x + 4}
                              y={r.y + 4}
                              width={Math.max(1, r.w - 8)}
                              height={Math.max(1, r.h - 8)}
                            />
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#${roomClipId})`} pointerEvents="none">
                          {lines.map((line, i) => (
                            <text
                              key={i}
                              x={cx}
                              y={cy + (i - (lines.length - 1) / 2) * fs * 1.18}
                              fontSize={fs}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className={
                                indoorImage
                                  ? roomNames[managedRoomId]
                                    ? styles.roomNameOverlay
                                    : styles.imageLabelHidden
                                  : room.placeholder
                                  ? styles.labelMuted
                                  : styles.label
                              }
                            >
                              {line}
                            </text>
                          ))}
                        </g>
                        {displayRoomName && (
                          <title>
                            {displayRoomName}
                            {room.nodeId && nodeById.get(room.nodeId)?.claimable
                              ? ` - ${
                                  claims[room.nodeId] ? "Occupied" : "Available"
                                }`
                              : ""}
                          </title>
                        )}
                      </g>
                    );
                  })}

                  {indoorWalkableEdges.map((edge) => (
                    <line
                      key={`walkable-edge-${edge.key}`}
                      x1={edge.fromPoint.x}
                      y1={edge.fromPoint.y}
                      x2={edge.toPoint.x}
                      y2={edge.toPoint.y}
                      className={styles.nodeConnection}
                      strokeWidth={6}
                    />
                  ))}

                  {showNodes &&
                    routingGraph.nodes
                      .filter(
                        (n) =>
                          buildingOfNode(n.id) === buildingId &&
                          n.floor === floor,
                      )
                      .map((n) => {
                        const p = nodePoint(buildingId, n.x, n.y);
                        return (
                          <circle
                            key={`node-${n.id}`}
                            cx={p.x}
                            cy={p.y}
                            r={8}
                            fill="#f43f5e"
                            stroke="#ffffff"
                            strokeWidth={2}
                            pointerEvents="none"
                          />
                        );
                      })}

                  {indoorRoute.map((line, i) =>
                    line.length > 1 ? (
                      <polyline
                        key={i}
                        points={line.map((p) => `${p.x},${p.y}`).join(" ")}
                        className={styles.route}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null,
                  )}

                  {builderMode &&
                    builderPoints
                      .filter((point) => point.mapKey === activeMapKey)
                      .map((point) => (
                        <g key={`builder-${point.id}`} pointerEvents="none">
                          <circle
                            cx={point.displayX}
                            cy={point.displayY}
                            r={10}
                            fill="#f97316"
                            stroke="#ffffff"
                            strokeWidth={3}
                          />
                          <text
                            x={point.displayX}
                            y={point.displayY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={styles.builderMarkerLabel}
                          >
                            {point.id}
                          </text>
                        </g>
                      ))}

                  {[
                    { id: startId, color: "#16a34a", label: "A", pulse: false },
                    { id: destId, color: "#dc2626", label: "B", pulse: true },
                  ].map((pin) => {
                    if (!pin.id) return null;
                    const n = nodeById.get(pin.id);
                    if (
                      !n ||
                      buildingOfNode(pin.id) !== buildingId ||
                      n.floor !== floor
                    )
                      return null;
                    const p = nodePoint(buildingId, n.x, n.y);
                    return (
                      <Pin
                        key={pin.label}
                        x={p.x}
                        y={p.y}
                        color={pin.color}
                        label={pin.label}
                        scale={4.2}
                        pulse={pin.pulse}
                      />
                    );
                  })}
                </svg>

                {plan.note && <div className={styles.note}>{plan.note}</div>}
              </div>
            )}
          </ZoomPan>

          {isAdmin && (
            <button
              type="button"
              className={styles.backBtn}
              style={{ top: phase === "building" ? 112 : 12 }}
              aria-pressed={roomEditingMode}
              onClick={() => {
                if (roomEditingMode) exitRoomEditingMode();
                else {
                  setBuilderMode(false);
                  setRoomEditingMode(true);
                  setNameSearch("");
                  const previousItem = managedItems.find((item) => item.id === selectedManagedId);
                  if (previousItem) {
                    const savedName = roomNames[previousItem.id] ?? previousItem.name;
                    setEditingRoomId(previousItem.id);
                    setEditingRoomName(savedName);
                    setEditingRoomOriginalName(savedName);
                    setRoomNameError("");
                  }
                }
              }}
            >
              {roomEditingMode ? "Close Name Editor" : "Edit Location Names"}
            </button>
          )}
          {phase === "building" && (
            <>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  if (roomEditingMode && !exitRoomEditingMode()) return;
                  backToCampus();
                }}
              >
                <span aria-hidden="true">&larr;</span>{" "}
                <span className={styles.backLong}>Back to Campus Overview</span>
                <span className={styles.backShort}>Campus</span>
              </button>
              {(buildingId === "cl-n" || buildingId === "cl-s") && (
                <button
                  type="button"
                  className={styles.backBtn}
                  style={{ top: 56 }}
                  onClick={() => {
                    if (roomEditingMode && !exitRoomEditingMode()) return;
                    setBuildingId("old");
                    setFloor(2);
                  }}
                >
                  <span aria-hidden="true">&larr;</span> Old Building, 2.1F
                </button>
              )}
              <div
                className={styles.floorSelector}
                role="group"
                aria-label="Floor selector"
              >
                {[...building.floors]
                  .sort((a, b) => b.floor - a.floor)
                  .map((f) => (
                    <button
                      key={f.floor}
                      type="button"
                      className={`${styles.floorBtn} ${
                        buildingId === "old" ? styles.floorBtnWide : ""
                      } ${f.floor === floor ? styles.floorActive : ""}`}
                      aria-pressed={f.floor === floor}
                      aria-label={floorDisplayName(roomNames, buildingId, f.floor, f.name)}
                      title={floorDisplayName(roomNames, buildingId, f.floor, f.name)}
                      onClick={() => {
                        if (
                          roomEditingMode &&
                          editingRoomName !== editingRoomOriginalName &&
                          editingRoomId &&
                          !window.confirm(
                            "You have unsaved room name changes. Change floor?",
                          )
                        ) {
                          return;
                        }
                        setFloor(f.floor);
                      }}
                    >
                      {roomNames[floorNameKey(buildingId, f.floor)] ??
                        (buildingId === "old"
                          ? f.floor === 1 ? "1F" : f.floor === 2 ? "2.1F" : f.floor === 3 ? "2.2F" : `${f.floor}F`
                          : `${f.floor}F`)}
                    </button>
                  ))}
              </div>
            </>
          )}

          {hasPins && phase !== "in" && phase !== "out" && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearPins}
            >
              Clear Pins
            </button>
          )}
        </div>

        {!hideSidebar && (
          <aside className={styles.sidebar}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Route</h2>
              <label className={styles.field}>
                <span
                  className={`${styles.dot} ${styles.dotStart}`}
                  aria-hidden="true"
                />
                <span className={styles.fieldLabel}>From</span>
                <select
                  value={startId ?? ""}
                  onChange={(e) => setStartId(e.target.value || null)}
                  className={styles.select}
                >
                  <option value="">Choose a start point</option>
                  {locationSelectGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span
                  className={`${styles.dot} ${styles.dotDest}`}
                  aria-hidden="true"
                />
                <span className={styles.fieldLabel}>To</span>
                <select
                  value={destId ?? ""}
                  onChange={(e) => setDestId(e.target.value || null)}
                  className={styles.select}
                >
                  <option value="">Choose a destination</option>
                  {locationSelectGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className={styles.rowBtns}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={swapPins}
                  disabled={!startId && !destId}
                >
                  Swap
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={clearPins}
                  disabled={!hasPins && !selectedId}
                >
                  Clear Pins
                </button>
              </div>

              {startId && destId && !route && (
                <p className={styles.warn}>
                  No walkable route was found between these two places.
                </p>
              )}

              {route && (
                <div className={styles.result}>
                  <div className={styles.distance}>
                    <strong>{Math.round(route.distance)} m</strong>
                    <span>
                      {" "}
                      about {Math.max(1, Math.round(route.distance / 78))} min
                      walk
                    </span>
                  </div>
                  <ol className={styles.legs}>
                    {legs.map((leg, i) => (
                      <li key={`${leg.key}-${i}`}>
                        <span>{leg.label}</span>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() =>
                            showLocation(leg.building, leg.floor ?? undefined)
                          }
                          disabled={phase === "in" || phase === "out"}
                        >
                          Show
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {!startId && !destId && (
                <p className={styles.hint}>
                  Click a gate or room on the map, or choose from the lists
                  above. Click a building to see its floors.
                </p>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

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
import campusMap01 from "../assets/campus-map-01.png";
import campusMap02 from "../assets/campus-map-02.png";
import campusMap03 from "../assets/campus-map-03.png";
import campusMap09 from "../assets/campus-map-09.png";
import campusMap10 from "../assets/campus-map-10.png";
import campusMap11 from "../assets/campus-map-11.png";
import campusMap12 from "../assets/campus-map-12.png";
import campusMap13 from "../assets/campus-map-13.png";
import campusMap14 from "../assets/campus-map-14.png";
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

const clIndicatorPoints: Record<"cl-n" | "cl-s", Pt> = {
  "cl-n": { x: 970, y: 190 },
  "cl-s": { x: 385, y: 190 },
};

function clExitForNode(id: string): Pt | null {
  if (
    id.startsWith("CL-N-") ||
    id === "OB-1-CL-N-EXIT" ||
    id === "OB-2-CL-N"
  ) {
    return clExitPoints["cl-n"];
  }
  if (
    id.startsWith("CL-S-") ||
    id === "OB-1-CL-S-EXIT" ||
    id === "OB-2-CL-S"
  ) {
    return clExitPoints["cl-s"];
  }
  return null;
}

const indoorImages: Record<
  string,
  { src: string; width: number; height: number; rotate?: boolean }
> = {
  "old-1": { src: campusMap02.src, width: 768, height: 1365, rotate: true },
  "old-2": { src: campusMap03.src, width: 768, height: 1365, rotate: true },
  ctmo: { src: campusMap09.src, width: 768, height: 1365 },
  "cl-n": { src: campusMap11.src, width: 768, height: 1365 },
  "cl-s": { src: campusMap10.src, width: 768, height: 1365 },
  "hm-1": { src: campusMap12.src, width: 768, height: 1365 },
  "hm-2": { src: campusMap13.src, width: 768, height: 1365 },
  "hm-3": { src: campusMap14.src, width: 768, height: 1365 },
};

function rotateOldRect(rect: Rect): Rect {
  return {
    x: 1365 - (rect.y + rect.h),
    y: rect.x,
    w: rect.h,
    h: rect.w,
  };
}

function imageRoomRect(
  buildingId: BuildingId,
  floorNumber: number,
  roomId: string,
): Rect | null {
  if (buildingId === "ctmo") {
    const y: Record<string, number> = {
      "1-1": 963,
      "1-2": 771,
      "1-3": 580,
      "1-GAD": 388,
      "1-RESEARCH": 196,
    };
    const top = y[roomId];
    return top === undefined ? null : { x: 160, y: top, w: 445, h: 190 };
  }
  if (buildingId === "cl-n" || buildingId === "cl-s") {
    const start = buildingId === "cl-n" ? 5 : 1;
    const roomNumber = Number(roomId.split("-").pop());
    if (!Number.isInteger(roomNumber)) return null;
    const index = roomNumber - start;
    return {
      x: buildingId === "cl-n" ? 193 : 385,
      y: 852 - index * 220,
      w: 232,
      h: 215,
    };
  }
  if (buildingId === "hm" && floorNumber >= 1 && floorNumber <= 3) {
    const number = Number(roomId.split("-").pop());
    const index = (number % 100) - 1;
    return { x: 163, y: index === 0 ? 344 : 678, w: 232, h: 334 };
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





function nodePoint(buildingId: BuildingId, x: number, y: number): Pt {
  if (buildingId === "old") return { x: 1365 - y, y: x };
  if (buildingId === "new") return planPoint(x, y);
  return { x, y };
}

function isSelectableNode(id: string): boolean {
  const n = nodeById.get(id);
  return !!n && (n.kind === "entrance" || n.kind === "gate");
}

interface LocationInfo {
  id: string;
  name: string;
  type: string;
  department?: string;
  building?: BuildingId;
  buildingName?: string;
  floor?: number;
  floorName?: string;
  claimable?: boolean;
}

function describeNode(id: string): LocationInfo | null {
  const node = nodeById.get(id);
  if (!node) return null;
  const b = buildingOfNode(id);

  if (b) {
    const building = buildingById[b];
    const plan = building.floors.find((f) => f.floor === node.floor);
    const room = plan?.rooms.find((r) => r.nodeId === id);
    return {
      id,
      name: shortName(node.name),
      type:
        room?.type ?? (node.kind === "gate" ? "Building entrance" : "Location"),
      department: room?.department,
      building: b,
      buildingName: building.name,
      floor: node.floor,
      floorName: plan?.name,
      claimable: node.claimable,
    };
  }

  const shape = campusShapes.find((s) => s.nodeId === id);
  return {
    id,
    name: node.name,
    type: shape?.type ?? (node.kind === "gate" ? "Campus gate" : "Location"),
  };
}

export const selectGroups = (() => {
  const groups: { label: string; options: { id: string; name: string }[] }[] =
    [];
  const outdoor = campusGraph.nodes.filter(
    (n) =>
      !buildingOfNode(n.id) && (n.kind === "entrance" || n.kind === "gate"),
  );
  groups.push({
    label: "Campus",
    options: outdoor.map((n) => ({ id: n.id, name: n.name })),
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
        .map((n) => ({ id: n.id, name: shortName(n.name) }));
      if (options.length > 0) {
        groups.push({ label: `${b.name}, ${f.name}`, options });
      }
    });
  });
  return groups;
})();

function zoomTransform(id: BuildingId): string {
  const r = buildingById[id].rect;
  const k = Math.min(
    CAMPUS_VIEWBOX.w / (r.w * 1.35),
    CAMPUS_VIEWBOX.h / (r.h * 1.35),
    3,
  );
  const cx = (r.x + r.w / 2) / CAMPUS_VIEWBOX.w;
  const cy = (r.y + r.h / 2) / CAMPUS_VIEWBOX.h;
  return `translate(${-k * (cx - 0.5) * 100}%, ${-k * (cy - 0.5) * 100}%) scale(${k})`;
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
  userPos,
  showNodes = false,
}: CampusMapProps = {}) {
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
  const [builderMode, setBuilderMode] = useState(false);
  const [builderPoints, setBuilderPoints] = useState<BuilderPoint[]>([]);
  const [builderCursor, setBuilderCursor] = useState<
    (BuilderCoordinates & { mapKey: string }) | null
  >(null);
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
    return findShortestPath(routingGraph, startId, destId);
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
        label = `${buildingById[b].name}, ${plan?.name ?? `Floor ${n.floor}`}`;
      }
      result.push({
        key,
        label,
        building: b,
        floor: b ? (n.floor ?? 1) : null,
      });
    });
    return result;
  }, [routeIds]);

  const campusRoute = useMemo(() => {
    const pts: Pt[] = [];
    const push = (p: Pt) => {
      const last = pts[pts.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
    };
    routeIds.forEach((id) => {
      const n = nodeById.get(id);
      if (!n) return;
      const clExit = clExitForNode(id);
      if (clExit) {
        push(clExit);
        return;
      }
      const b = buildingOfNode(id);
      if (b) push(buildingById[b].door);
      else push({ x: n.x, y: n.y });
    });
    return pts;
  }, [routeIds]);

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
    if (!focus) return;
    const timer = setTimeout(() => {
      if (focus.kind === "campus") {
        clearTimers();
        setZoomed(false);
        setPhase("campus");
      } else {
        clearTimers();
        setBuildingId(focus.id);
        setFloor(focus.floor ?? 1);
        if (phase === "building") {
          setZoomed(false);
          return;
        }
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
  const selected = selectedId ? describeNode(selectedId) : null;
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

  const onShapeClick = (shape: CampusShape) => {
    if (builderMode) return;
    if (phase !== "campus") return;
    if (shape.buildingId) {
      enterBuilding(shape.buildingId);
      return;
    }
    if (!shape.nodeId) return;
    pick(shape.nodeId);
  };

  const selectNode = (id: string) => {
    if (isSelectableNode(id)) pick(id);
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
    const isOldImage = buildingId === "old" && !!indoorImage?.rotate;
    const x = isOldImage ? displayY : displayX;
    const y = isOldImage ? (indoorImage?.height ?? 1365) - displayX : displayY;
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
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
        label: phase === "campus" ? "Campus" : `${building.name}, ${plan.name}`,
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
  const phaseLabel =
    phase === "building" || phase === "out" || phase === "in"
      ? `${building.name}, ${plan.name}`
      : "Campus overview";

  return (
    <div className={styles.root}>
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
              Move the cursor to preview coordinates, then click once per node.
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
      <div
        className={`${styles.layout} ${hideSidebar ? styles.noSidebar : ""}`}
      >
        <div className={styles.stage}>
          <div className={styles.chip} aria-live="polite">
            {phaseLabel}
          </div>

          <div
            className={`${styles.campusLayer} ${phase === "out" ? styles.fast : ""}`}
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
                const kind = pinKind(s.nodeId);
                const selectable = !!s.nodeId || !!s.buildingId;
                const cls = [
                  styles.shape,
                  styles[`tone_${s.tone}`],
                  selectable ? styles.hoverable : "",
                  selectedId && selectedId === s.nodeId
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
                    aria-label={selectable ? `${s.label}, select` : undefined}
                    onKeyDown={(e) => {
                      if (selectable && (e.key === "Enter" || e.key === " ")) {
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
                      className={campusMap01 ? styles.imageHitbox : cls}
                    />
                    <text
                      x={cx}
                      y={cy}
                      className={
                        campusMap01 ? styles.imageLabelHidden : styles.label
                      }
                      fontSize={s.fontSize ?? 11}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={
                        s.vertical ? `rotate(-90 ${cx} ${cy})` : undefined
                      }
                    >
                      {s.label}
                    </text>
                    <title>{s.label}</title>
                  </g>
                );
              })}

              {buildings
                .filter((b) => b.id === "old" || b.id === "new")
                .map((b) => {
                  const cx = b.rect.x + b.rect.w / 2;
                  const cy = b.rect.y + b.rect.h / 2;
                  return (
                    <g
                      key={b.id}
                      onClick={() => {
                        if (!builderMode && phase === "campus") {
                          enterBuilding(b.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${b.name}, open floor plans`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (phase === "campus") enterBuilding(b.id);
                        }
                      }}
                    >
                      <rect
                        x={b.rect.x}
                        y={b.rect.y}
                        width={b.rect.w}
                        height={b.rect.h}
                        rx={4}
                        className={styles.imageHitbox}
                      />
                      <text
                        x={cx}
                        y={cy - 10}
                        className={styles.imageLabelHidden}
                        fontSize={15}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(-90 ${cx} ${cy - 10})`}
                      >
                        {b.name}
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
                      <title>{`${b.name}: click to see the floor plans`}</title>
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
                    <Pin x={p.x} y={p.y} color="#16a34a" label="A" scale={1} />
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
                      scale={1}
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
              className={`${styles.indoorLayer} ${phase === "out" ? styles.indoorExit : styles.indoorEnter}`}
            >
              <svg
                viewBox={
                  indoorImage
                    ? `0 0 ${indoorImage.rotate ? indoorImage.height : indoorImage.width} ${indoorImage.rotate ? indoorImage.width : indoorImage.height}`
                    : `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
                }
                className={styles.svg}
                role="img"
                aria-label={`${building.name}, ${plan.name} floor plan`}
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
                  const r =
                    imageRoomRect(buildingId, floor, room.id) ??
                    (indoorImage ? null : planRect(room));
                  if (!r) return null;
                  const lines = room.label ? room.label.split("\n") : [];
                  const longest = Math.max(1, ...lines.map((l) => l.length));
                  const fs = Math.max(
                    18,
                    Math.min(
                      46,
                      (r.w * 0.88) / (0.6 * longest),
                      (r.h * 0.7) / Math.max(1, lines.length),
                    ),
                  );
                  const selectable =
                    !!room.nodeId &&
                    (isSelectableNode(room.nodeId) || !!room.openBuildingId);
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
                    selectedId && selectedId === room.nodeId
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
                        if (room.openBuildingId) {
                          enterBuilding(room.openBuildingId);
                        } else if (room.nodeId) {
                          selectNode(room.nodeId);
                        }
                      }}
                      role={selectable ? "button" : undefined}
                      tabIndex={selectable ? 0 : undefined}
                      aria-label={
                        selectable
                          ? `${room.label.replace("\n", " ")}, select`
                          : undefined
                      }
                      onKeyDown={(e) => {
                        if (
                          selectable &&
                          room.nodeId &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          if (room.openBuildingId) {
                            enterBuilding(room.openBuildingId);
                          } else {
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
                      {lines.map((line, i) => (
                        <text
                          key={i}
                          x={cx}
                          y={cy + (i - (lines.length - 1) / 2) * fs * 1.2}
                          fontSize={fs}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={
                            indoorImage
                              ? styles.imageLabelHidden
                              : room.placeholder
                                ? styles.labelMuted
                                : styles.label
                          }
                        >
                          {line}
                        </text>
                      ))}
                      {room.label && (
                        <title>
                          {room.label.replace("\n", " ")}
                          {room.nodeId && nodeById.get(room.nodeId)?.claimable
                            ? ` - ${claims[room.nodeId] ? "Occupied" : "Available"}`
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

                {buildingId === "old" && floor === 1 &&
                  (["cl-s", "cl-n"] as const).map((id) => {
                    const point = clIndicatorPoints[id];
                    return (
                      <g
                        key={`cl-indicator-${id}`}
                        className={styles.clRoomIndicator}
                        transform={`translate(${point.x} ${point.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={
                          id === "cl-s"
                            ? "Open CL Rooms 1–4"
                            : "Open CL Rooms 5–8"
                        }
                        onClick={() => {
                          if (!builderMode) {
                            setBuildingId(id);
                            setFloor(1);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            !builderMode &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            setBuildingId(id);
                            setFloor(1);
                          }
                        }}
                      >
                        <circle r={18} />
                        <text y={2.8} textAnchor="middle">
                          {id === "cl-s" ? "1–4" : "5–8"}
                        </text>
                        <title>
                          {id === "cl-s"
                            ? "Open CL Rooms 1–4"
                            : "Open CL Rooms 5–8"}
                        </title>
                      </g>
                    );
                  })}

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

          {phase === "building" && (
            <>
              <button
                type="button"
                className={styles.backBtn}
                onClick={backToCampus}
              >
                <span aria-hidden="true">&larr;</span> Back to Campus Overview
              </button>
              {(buildingId === "cl-n" || buildingId === "cl-s") && (
                <button
                  type="button"
                  className={styles.backBtn}
                  style={{ top: 56 }}
                  onClick={() => {
                    setBuildingId("old");
                    setFloor(2);
                  }}
                >
                  <span aria-hidden="true">&larr;</span> Old Building, 2nd Floor
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
                      className={`${styles.floorBtn} ${f.floor === floor ? styles.floorActive : ""}`}
                      aria-pressed={f.floor === floor}
                      aria-label={f.name}
                      title={f.name}
                      onClick={() => setFloor(f.floor)}
                    >
                      {f.floor}F
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
                  {selectGroups.map((g) => (
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
                  {selectGroups.map((g) => (
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

            {selected && (
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>{selected.name}</h2>
                <dl className={styles.info}>
                  <dt>Type</dt>
                  <dd>{selected.type}</dd>
                  {selected.department && (
                    <>
                      <dt>Department or office</dt>
                      <dd>{selected.department}</dd>
                    </>
                  )}
                  <dt>Location</dt>
                  <dd>
                    {selected.buildingName
                      ? `${selected.buildingName}${selected.floorName ? `, ${selected.floorName}` : ""}`
                      : "Campus grounds"}
                  </dd>
                  {claims[selected.id] && (
                    <>
                      <dt>Claimed by</dt>
                      <dd>{claims[selected.id]}</dd>
                    </>
                  )}
                  {selected.claimable && (
                    <>
                      <dt>Availability</dt>
                      <dd>{claims[selected.id] ? "Occupied" : "Available"}</dd>
                    </>
                  )}
                </dl>
                <div className={styles.rowBtns}>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${styles.startBtn}`}
                    onClick={() => setStartId(selected.id)}
                  >
                    Set as start
                  </button>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${styles.destBtn}`}
                    onClick={() => setDestId(selected.id)}
                  >
                    Set as destination
                  </button>
                </div>
                {selected.building &&
                  (phase === "campus" || phase === "building") && (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() =>
                        showLocation(selected.building ?? null, selected.floor)
                      }
                    >
                      Show on floor plan
                    </button>
                  )}
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

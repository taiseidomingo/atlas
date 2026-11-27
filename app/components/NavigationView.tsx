"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CampusMap, { MapFocus, RouteSummary, buildSelectGroups } from "./CampusMap";
import PlaceCard from "./PlaceCard";
import { buildingOfNode, buildingById } from "@/lib/mapData";
import { buildingDisplayName, displayName, floorDisplayName } from "@/lib/locationNames";
import type { BuildingId } from "@/lib/mapData";
import { campusGraph } from "@/lib/graph";
import { routingGraph } from "@/lib/routingGraph";
import { geoReady, toMapPoint } from "@/lib/geo";
import { getPlaceInfo } from "@/lib/placeInfo";
import styles from "./NavigationView.module.css";

type Focus = (MapFocus & { nonce: number }) | null;
type LocStatus =
  | "locating"
  | "onCampus"
  | "offCampus"
  | "denied"
  | "unavailable"
  | "uncalibrated";

const known = new Set(selectGroups.flatMap((g) => g.options.map((o) => o.id)));
const outdoorNodes = routingGraph.nodes.filter((n) => !buildingOfNode(n.id));

function nearestOutdoor(p: { x: number; y: number }) {
  let best = outdoorNodes[0];
  let bestD = Infinity;
  outdoorNodes.forEach((n) => {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d < bestD) {
      best = n;
      bestD = d;
    }
  });
  return { node: best, dist: bestD };
}

const STATUS_TEXT: Record<LocStatus, string> = {
  locating: "Finding your location…",
  onCampus: "📍 Using your location as the starting point.",
  offCampus:
    "You don't seem to be on campus. Tap the map to pin where you are, then where you want to go.",
  denied:
    "Location permission is off. Tap the map to pin where you are, then where you want to go.",
  unavailable:
    "Couldn't get your location. Tap the map to pin where you are, then where you want to go.",
  uncalibrated:
    "Tap the map to pin where you are, then where you want to go. (Live location needs lib/geo.ts calibrated.)",
};

export default function NavigationView() {
  const params = useSearchParams();
  const [start, setStartState] = useState<string | null>(() => {
    const from = params.get("from");
    return from && known.has(from) ? from : null;
  });
  const [dest, setDest] = useState<string | null>(() => {
    const to = params.get("to");
    return to && known.has(to) ? to : null;
  });
  const [view, setView] = useState<"campus" | BuildingId>("campus");
  const [names, setNames] = useState<Record<string, string>>({});
  const selectGroups = useMemo(() => buildSelectGroups(names), [names]);
  const [focus, setFocus] = useState<Focus>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const focusNonce = useRef(0);
  const [quickRoute, setQuickRoute] = useState(true);
  const [showNodes, setShowNodes] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<LocStatus>(
    geoReady() ? "locating" : "uncalibrated",
  );
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/names")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.names && typeof data.names === "object") setNames(data.names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const manualStart = useRef(false);
  const gpsStart = useRef<string | null>(null);

  const setStart = useCallback((id: string | null) => {
    manualStart.current = id !== null;
    gpsStart.current = null;
    setStartState(id);
  }, []);

  useEffect(() => {
    if (!geoReady() || !("geolocation" in navigator)) {
      if (geoReady()) setStatus("unavailable");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const p = toMapPoint(pos.coords.latitude, pos.coords.longitude);
        if (!p) return setStatus("unavailable");
        const { node, dist } = nearestOutdoor(p);
        const inside =
          p.x > -30 && p.x < 492 && p.y > -30 && p.y < 852 && dist < 120;
        if (!inside) {
          setUserPos(null);
          return setStatus("offCampus");
        }
        setUserPos(p);
        setStatus("onCampus");
        if (!manualStart.current) {
          gpsStart.current = node.id;
          setStartState(node.id);
        }
      },
      (err) => setStatus(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const goTo = useCallback((f: MapFocus) => {
    const nextView = f.kind === "campus" ? "campus" : f.id;
    focusNonce.current += 1;
    setView(nextView);
    setFocus({ ...f, nonce: focusNonce.current });
  }, []);

  useEffect(() => {
    const v = params.get("view");
    if (v === "new" || v === "old") {
      setFocus({ kind: "building", id: v, nonce: Date.now() });
    }
  }, [params]);

  const showDirections = () => {
    if (!start) return;
    const b = buildingOfNode(start);
    const node = campusGraph.nodes.find((n) => n.id === start);
    goTo(
      b
        ? { kind: "building", id: b, floor: node?.floor ?? 1 }
        : { kind: "campus" },
    );
  };

  const info = useMemo(() => {
    if (!selected) return null;
    const base = getPlaceInfo(selected);
    if (!base) return null;
    const name = displayName(names, selected, base.name);
    const place = base.buildingId
      ? `${buildingDisplayName(names, base.buildingId, buildingById[base.buildingId].name)}, ${floorDisplayName(names, base.buildingId, base.floor ?? 1, buildingById[base.buildingId].floors.find((floor) => floor.floor === (base.floor ?? 1))?.name ?? `Floor ${base.floor ?? 1}`)}`
      : base.place;
    return { ...base, name, place };
  }, [selected, names]);

  const select = (
    value: string | null,
    onChange: (v: string | null) => void,
    label: string,
    isStart = false,
  ) => (
    <div className={styles.field}>
      <label>{label}</label>
      <select
        className="select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Choose a location</option>
        {isStart && value && !known.has(value) && (
          <option value={value}>📍 My location</option>
        )}
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
    </div>
  );

  return (
    <>
      <h1 className="pageTitle">Campus Navigation</h1>
      <p className="sub">
        Tap a place for details. With tap-to-route on, the first tap sets your
        start and the next tap sets your destination.
      </p>

      <div className={styles.bar}>
        {select(start, setStart, "Start", true)}
        {select(dest, setDest, "Destination")}
        <button
          type="button"
          className="btn"
          onClick={showDirections}
          disabled={!start || !dest}
        >
          Directions
        </button>
      </div>

      <div className={styles.options}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={quickRoute}
            onChange={(e) => setQuickRoute(e.target.checked)}
          />
          Tap-to-route
        </label>
        {process.env.NODE_ENV !== "production" && (
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showNodes}
            onChange={(e) => setShowNodes(e.target.checked)}
          />
          Show path nodes
        </label>
        )}
        <span className={styles.banner}>{STATUS_TEXT[status]}</span>
      </div>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["campus", "Grounds", { kind: "campus" }],
            ["new", buildingDisplayName(names, "new", "New Building"), { kind: "building", id: "new" }],
            ["old", buildingDisplayName(names, "old", "Old Building"), { kind: "building", id: "old" }],
            ["ctmo", buildingDisplayName(names, "ctmo", "CTMO"), { kind: "building", id: "ctmo" }],
            ["hm", buildingDisplayName(names, "hm", "HM Building"), { kind: "building", id: "hm" }],
            ["cl-s", buildingDisplayName(names, "cl-s", "CL Building (CL 1-4)"), { kind: "building", id: "cl-s" }],
            ["cl-n", buildingDisplayName(names, "cl-n", "CL Building (CL 5-8)"), { kind: "building", id: "cl-n" }],
          ] as [string, string, MapFocus][]
        ).map(([id, label, f]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`${styles.tab} ${view === id ? styles.tabOn : ""}`}
            onClick={() => goTo(f)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className={`${styles.stageGrid} ${info ? styles.stageGridOpen : ""}`}
      >
        <CampusMap
          hideSidebar
          start={start}
          dest={dest}
          onStartChange={setStart}
          onDestChange={setDest}
          focus={focus}
          onViewChange={setView}
          onRoute={setRoute}
          quickRoute={quickRoute}
          onSelect={setSelected}
          userPos={userPos}
          showNodes={showNodes}
        />
        {info && (
          <PlaceCard
            info={info}
            isStart={start === info.id}
            isDest={dest === info.id}
            onStart={() => setStart(info.id)}
            onDest={() => setDest(info.id)}
            onClose={() => setSelected(null)}
            onViewBuilding={
              info.buildingId && view === "campus"
                ? () =>
                    goTo({
                      kind: "building",
                      id: info.buildingId!,
                      floor: info.floor,
                    })
                : undefined
            }
          />
        )}
      </div>

      {route && (
        <div className={`card ${styles.summary}`}>
          <div>
            <div className={styles.big}>{Math.round(route.distance)} m</div>
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              ≈ {Math.max(1, Math.round(route.distance / 80))} min walk
            </div>
          </div>
          <ol className={styles.legs}>
            {route.legs.map((l, i) => (
              <li key={i}>{l.label}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

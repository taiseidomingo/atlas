"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CampusMap, {
  AdminMapTool,
  MapFocus,
  RouteSummary,
  buildSelectGroups,
  selectGroups,
} from "./CampusMap";
import { routingGraph } from "@/lib/routingGraph";
import { geoReady, toMapPoint } from "@/lib/geo";
import { getPlaceInfo } from "@/lib/placeInfo";
import styles from "./NavigationView.module.css";
import { buildingOfNode } from "@/lib/mapData";
import { buildingDisplayName } from "@/lib/locationNames";
import type { BuildingId } from "@/lib/mapData";

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
    "You don't seem to be on campus. Tap a place on the map to set your start.",
  denied:
    "Location is off. Tap a place on the map to set your start and destination.",
  unavailable:
    "Couldn't get your location. Tap a place on the map to set your start and destination.",
  uncalibrated:
    "Tap a place on the map to set it as your start or destination.",
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
  const adminTool = useMemo<AdminMapTool | null>(() => {
    const value = params.get("admin");
    return value === "names" || value === "nodes" ? value : null;
  }, [params]);
  const [view, setView] = useState<"campus" | BuildingId>("campus");
  const [names, setNames] = useState<Record<string, string>>({});
  const selectGroups = useMemo(() => buildSelectGroups(names), [names]);
  const [focus, setFocus] = useState<Focus>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const focusNonce = useRef(0);
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
        if (!cancelled && data?.names && typeof data.names === "object")
          setNames(data.names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

  const showLeg = (building: BuildingId | null, floor: number | null) => {
    goTo(
      building
        ? { kind: "building", id: building, floor: floor ?? 1 }
        : { kind: "campus" },
    );
  };

  const info = useMemo(
    () => (selected ? getPlaceInfo(selected, names) : null),
    [selected, names],
  );

  const chooseStart = (id: string) => {
    setStart(id);
    if (dest === id) setDest(null);
    setSelected(null);
  };

  const chooseDest = (id: string) => {
    setDest(id);
    if (start === id) setStart(null);
    setSelected(null);
  };

  const swap = () => {
    const nextStart = dest;
    setDest(start);
    setStart(nextStart);
  };

  const clear = () => {
    setStart(null);
    setDest(null);
    setSelected(null);
  };

  const select = (
    value: string | null,
    onChange: (v: string | null) => void,
    label: string,
    dotClass: string,
    isStart = false,
  ) => (
    <div className={styles.field}>
      <label>
        <span className={`${styles.dot} ${dotClass}`} aria-hidden="true" />
        {label}
      </label>
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
        Tap any place on the map, then set it as your start or destination.
        The route appears as soon as both are chosen.
      </p>

      <div className={styles.bar}>
        {select(start, setStart, "Start", styles.dotStart, true)}
        {select(dest, setDest, "Destination", styles.dotDest)}
        <div className={styles.barActions}>
          <button
            type="button"
            className="btnGhost"
            onClick={swap}
            disabled={!start && !dest}
            aria-label="Swap start and destination"
            title="Swap start and destination"
          >
            ⇅ Swap
          </button>
          <button
            type="button"
            className="btnGhost"
            onClick={clear}
            disabled={!start && !dest}
          >
            Clear
          </button>
        </div>
      </div>

      <p className={styles.banner}>{STATUS_TEXT[status]}</p>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["campus", "Grounds", { kind: "campus" }],
            [
              "new",
              buildingDisplayName(names, "new", "New Building"),
              { kind: "building", id: "new" },
            ],
            [
              "old",
              buildingDisplayName(names, "old", "Old Building"),
              { kind: "building", id: "old" },
            ],
            [
              "ctmo",
              buildingDisplayName(names, "ctmo", "CTMO"),
              { kind: "building", id: "ctmo" },
            ],
            [
              "hm",
              buildingDisplayName(names, "hm", "HM Building"),
              { kind: "building", id: "hm" },
            ],
            [
              "cl-s",
              buildingDisplayName(names, "cl-s", "CL Building (CL 1-4)"),
              { kind: "building", id: "cl-s" },
            ],
            [
              "cl-n",
              buildingDisplayName(names, "cl-n", "CL Building (CL 5-8)"),
              { kind: "building", id: "cl-n" },
            ],
            [
              "gym",
              buildingDisplayName(names, "gym", "Gymnasium"),
              { kind: "building", id: "gym" },
            ],
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

      <div className={styles.mapWrap}>
        <CampusMap
          hideSidebar
          start={start}
          dest={dest}
          onStartChange={setStart}
          onDestChange={setDest}
          focus={focus}
          onViewChange={setView}
          onRoute={setRoute}
          onSelect={setSelected}
          onNamesChange={setNames}
          userPos={userPos}
          initialAdminTool={adminTool}
        />
        {info && (
          <div
            className={styles.actionSheet}
            role="dialog"
            aria-label={`${info.name}: set as start or destination`}
          >
            <div className={styles.actionInfo}>
              <strong className={styles.actionName}>{info.name}</strong>
              <span className={styles.actionMeta}>
                {info.type} · {info.place}
              </span>
            </div>
            <div className={styles.actionButtons}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionStart} ${
                  start === info.id ? styles.actionOn : ""
                }`}
                onClick={() => chooseStart(info.id)}
              >
                <span className={`${styles.dot} ${styles.dotStart}`} />
                {start === info.id ? "Start ✓" : "Set as start"}
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionDest} ${
                  dest === info.id ? styles.actionOn : ""
                }`}
                onClick={() => chooseDest(info.id)}
              >
                <span className={`${styles.dot} ${styles.dotDest}`} />
                {dest === info.id ? "Destination ✓" : "Set as destination"}
              </button>
              <button
                type="button"
                className={styles.actionClose}
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {start && dest && !route && (
        <p className={styles.warn} role="status">
          No walkable route was found between these two places.
        </p>
      )}

      {route && (
        <div className={`card ${styles.summary}`} aria-live="polite">
          <div>
            <div className={styles.big}>{Math.round(route.distance)} m</div>
            <div className={styles.summaryMeta}>
              ≈ {Math.max(1, Math.round(route.distance / 80))} min walk
            </div>
          </div>
          <ol className={styles.legs}>
            {route.legs.map((l, i) => (
              <li key={i}>
                <span>{l.label}</span>
                <button
                  type="button"
                  className={styles.legBtn}
                  onClick={() => showLeg(l.building, l.floor)}
                >
                  Show
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

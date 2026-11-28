"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as RPE,
} from "react";
import { useSearchParams } from "next/navigation";
import CampusMap, {
  AdminMapTool,
  CATEGORY_LABEL,
  MapFocus,
  RouteSummary,
  buildSelectGroups,
  roomCategory,
  selectGroups,
} from "./CampusMap";
import AssistantChat from "./AssistantChat";
import Icon from "./Icon";
import { routingGraph, routingNodeById } from "@/lib/routingGraph";
import { geoReady, toMapPoint } from "@/lib/geo";
import { getPlaceInfo } from "@/lib/placeInfo";
import { buildingOfNode } from "@/lib/mapData";
import type { BuildingId } from "@/lib/mapData";
import { buildingDisplayName, displayName, floorDisplayName } from "@/lib/locationNames";
import { buildRouteGuide, type NameLookup } from "@/lib/routeGuide";
import { nav, useNav } from "@/lib/navStore";
import { chat, useChat } from "@/lib/chatStore";
import styles from "./NavigationView.module.css";

type Focus = (MapFocus & { nonce: number }) | null;
type Tab = "assistant" | "directions";
type Sheet = "min" | "mid" | "max";
type LocStatus = "locating" | "onCampus" | "offCampus" | "denied" | "unavailable" | "uncalibrated";

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
  onCampus: "Using your live location as the starting point.",
  offCampus: "You don't seem to be on campus — tap the map to set your start.",
  denied: "Location is off — tap the map to set your start.",
  unavailable: "Couldn't get your location — tap the map to set your start.",
  uncalibrated: "Tap the map, ask the assistant, or choose places below.",
};

const BUILDING_TABS: [string, string, MapFocus][] = [
  ["campus", "Campus", { kind: "campus" }],
  ["new", "New Building", { kind: "building", id: "new" }],
  ["old", "Old Building", { kind: "building", id: "old" }],
  ["ctmo", "CTMO", { kind: "building", id: "ctmo" }],
  ["hm", "HM Building", { kind: "building", id: "hm" }],
  ["cl-s", "CL 1-4", { kind: "building", id: "cl-s" }],
  ["cl-n", "CL 5-8", { kind: "building", id: "cl-n" }],
  ["gym", "Gymnasium", { kind: "building", id: "gym" }],
];

function PlaceSelect({
  value,
  onChange,
  label,
  tone,
  groups,
  labelOf,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  tone: "start" | "dest";
  groups: ReturnType<typeof buildSelectGroups>;
  labelOf: (id: string | null) => string;
}) {
  return (
    <label className={styles.field}>
      <span className={`${styles.fieldDot} ${tone === "start" ? styles.dotStart : styles.dotDest}`}>
        {tone === "start" ? "A" : "B"}
      </span>
      <span className={styles.fieldBody}>
        <span className={styles.fieldLabel}>{label}</span>
        <select
          className={styles.select}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{tone === "start" ? "Choose starting point" : "Choose destination"}</option>
          {value && !known.has(value) && <option value={value}>📍 {labelOf(value)}</option>}
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </span>
    </label>
  );
}

/**
 * Tapped place: a bottom sheet that is compact by default on phones
 * (name, where, Directions) and expands for details and start / go controls.
 */
function PlaceCard({
  info,
  names,
  defaultOpen,
  isStart,
  isDest,
  onClose,
  onDirections,
  onStart,
  onDest,
}: {
  info: NonNullable<ReturnType<typeof getPlaceInfo>>;
  names: Record<string, string>;
  defaultOpen: boolean;
  isStart: boolean;
  isDest: boolean;
  onClose: () => void;
  onDirections: () => void;
  onStart: () => void;
  onDest: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const category = roomCategory(info.type, info.name);
  const building = info.buildingId
    ? buildingDisplayName(names, info.buildingId, info.place.split(",")[0])
    : "Campus grounds";
  const floorName =
    info.buildingId && info.floor
      ? floorDisplayName(names, info.buildingId, info.floor, info.place.split(",").slice(1).join(",").trim())
      : null;
  return (
    <div
      className={`${styles.placeSheet} ${open ? styles.placeOpen : ""}`}
      role="dialog"
      aria-label={`${info.name} details`}
    >
      <button
        type="button"
        className={styles.sheetGrip}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Show less" : "Show details"}
      >
        <span />
      </button>
      <div className={styles.placeHead}>
        <span className={`${styles.placeBadge} ${styles[`badge_${category}`]}`} aria-hidden="true">
          <Icon name={info.buildingId ? "building" : "pin"} size={18} />
        </span>
        <button type="button" className={styles.placeInfo} onClick={() => setOpen((o) => !o)}>
          <strong>{info.name}</strong>
          <span>
            {building}
            {floorName ? ` · ${floorName}` : ""}
          </span>
        </button>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      {open && (
        <div className={styles.placeDetails}>
          <dl className={styles.facts}>
            <div>
              <dt>Building</dt>
              <dd>{building}</dd>
            </div>
            {floorName && (
              <div>
                <dt>Floor</dt>
                <dd>{floorName}</dd>
              </div>
            )}
            <div>
              <dt>Type</dt>
              <dd>
                {info.type}
                {CATEGORY_LABEL[category] !== info.type && category !== "other"
                  ? ` (${CATEGORY_LABEL[category].toLowerCase()})`
                  : ""}
              </dd>
            </div>
          </dl>
          {info.description && <p className={styles.placeDesc}>{info.description}</p>}
        </div>
      )}

      <div className={`${styles.placeActions} ${open ? "" : styles.placeActionsCompact}`}>
        <button type="button" className={`${styles.btnPrimary} ${styles.btnBig}`} onClick={onDirections}>
          <Icon name="route" size={17} /> Directions
        </button>
        {open ? (
          <>
            <button
              type="button"
              className={`${styles.btnGhost} ${isStart ? styles.onStart : ""}`}
              onClick={onStart}
            >
              <span className={`${styles.miniDot} ${styles.dotStart}`}>A</span>
              {isStart ? "Start ✓" : "Start here"}
            </button>
            <button
              type="button"
              className={`${styles.btnGhost} ${isDest ? styles.onDest : ""}`}
              onClick={onDest}
            >
              <span className={`${styles.miniDot} ${styles.dotDest}`}>B</span>
              {isDest ? "Destination ✓" : "Go here"}
            </button>
          </>
        ) : (
          <button type="button" className={styles.btnGhost} onClick={() => setOpen(true)}>
            More <Icon name="chevronUp" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// Phones and tablets get the bottom-sheet layout (matches the CSS breakpoint).
const SHEET_QUERY = "(max-width: 1023px)";
function useSheetLayout(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SHEET_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );
}

export default function NavigationView() {
  const params = useSearchParams();
  const { start, dest, focus: placeFocus, routeNonce, picking, candidate } = useNav();
  const { mapRequest, messages } = useChat();
  const adminTool = useMemo<AdminMapTool | null>(() => {
    const value = params.get("admin");
    return value === "names" || value === "nodes" ? value : null;
  }, [params]);
  const [view, setView] = useState<"campus" | BuildingId>("campus");
  const [viewFloor, setViewFloor] = useState<number | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // The route card can shrink to a pill to free the map; a new route reopens it.
  const [routeMin, setRouteMin] = useState(false);
  const [routeMinFor, setRouteMinFor] = useState(routeNonce);
  if (routeMinFor !== routeNonce) {
    setRouteMinFor(routeNonce);
    setRouteMin(false);
  }
  const [names, setNames] = useState<Record<string, string>>({});
  const groups = useMemo(() => buildSelectGroups(names), [names]);
  const [focus, setFocus] = useState<Focus>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const focusNonce = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<LocStatus>(geoReady() ? "locating" : "uncalibrated");
  const [tab, setTab] = useState<Tab>("assistant");
  // Phones/tablets start with the sheet collapsed so the map gets the screen.
  const [sheet, setSheet] = useState<Sheet>("min");
  const [fullMap, setFullMap] = useState(false);
  const sheetLayout = useSheetLayout();
  const manualStart = useRef(false);

  // Deep links: /navigation?from=…&to=… (home search, older chat links).
  const appliedParams = useRef(false);
  useEffect(() => {
    if (appliedParams.current) return;
    const from = params.get("from");
    const to = params.get("to");
    const timer = setTimeout(() => {
      // Marked here, not before: a cancelled timer (React dev double effects)
      // must be able to run again.
      appliedParams.current = true;
      if (from && known.has(from)) nav.setStart(from);
      if (to && known.has(to)) {
        nav.setDest(to);
        if (!(from && known.has(from))) nav.showPlace(to);
      }
      const v = params.get("view");
      if (v === "new" || v === "old") {
        focusNonce.current += 1;
        setFocus({ kind: "building", id: v, nonce: focusNonce.current });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/names")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.names && typeof data.names === "object") setNames(data.names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Live GPS (only once the campus map has calibration anchors).
  useEffect(() => {
    if (!geoReady() || !("geolocation" in navigator)) {
      if (geoReady()) setTimeout(() => setStatus("unavailable"), 0);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const p = toMapPoint(pos.coords.latitude, pos.coords.longitude);
        if (!p) return setStatus("unavailable");
        const { node, dist } = nearestOutdoor(p);
        const inside = p.x > -30 && p.x < 8030 && p.y > -30 && p.y < 4530 && dist < 400;
        if (!inside) {
          setUserPos(null);
          return setStatus("offCampus");
        }
        setUserPos(p);
        setStatus("onCampus");
        if (!manualStart.current) nav.setStart(node.id);
      },
      (err) => setStatus(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const clientNames = useMemo<NameLookup>(
    () => ({
      place: (id, fallback) => displayName(names, id, fallback),
      building: (id, fallback) => buildingDisplayName(names, id, fallback),
      floor: (id, floor, fallback) => floorDisplayName(names, id, floor, fallback),
    }),
    [names],
  );

  const guide = useMemo(
    () => (start && dest ? buildRouteGuide(start, dest, clientNames) : null),
    [start, dest, clientNames],
  );

  const labelOf = useCallback(
    (id: string | null) => {
      if (!id) return "";
      const n = routingNodeById.get(id);
      if (!n) return id;
      if (n.kind !== "junction") return getPlaceInfo(id, names)?.name ?? n.name;
      // A tapped spot on a path: describe it by the nearest named place.
      const b = buildingOfNode(id);
      let best: string | null = null;
      let bestD = Infinity;
      for (const m of routingGraph.nodes) {
        if (m.kind === "junction" || buildingOfNode(m.id) !== b || m.floor !== n.floor) continue;
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < bestD) {
          bestD = d;
          best = m.id;
        }
      }
      return best ? `Pinned spot near ${getPlaceInfo(best, names)?.name ?? best}` : "Pinned spot";
    },
    [names],
  );

  const goTo = useCallback((f: MapFocus) => {
    focusNonce.current += 1;
    setFocus({ ...f, nonce: focusNonce.current });
  }, []);

  const info = useMemo(() => (selected ? getPlaceInfo(selected, names) : null), [selected, names]);

  // Phones: when the assistant moves the map, collapse the sheet so the map
  // gets the screen (the collapsed sheet still shows the latest reply).
  const lastMapRequest = useRef(mapRequest);
  useEffect(() => {
    if (lastMapRequest.current === mapRequest) return;
    lastMapRequest.current = mapRequest;
    const timer = setTimeout(() => setSheet("min"), 0);
    return () => clearTimeout(timer);
  }, [mapRequest]);

  // A "which one did you mean?" reply needs the list: open the sheet for it.
  const lastBot = [...messages].reverse().find((m) => m.from === "bot");
  const lastBotId = lastBot?.id;
  const lastBotHasOptions = !!lastBot?.options?.length;
  useEffect(() => {
    if (!lastBotHasOptions) return;
    const timer = setTimeout(() => setSheet((s) => (s === "min" ? "mid" : s)), 0);
    return () => clearTimeout(timer);
  }, [lastBotId, lastBotHasOptions]);

  // Picking a start: collapse the sheet so the map is easy to tap.
  const wasPicking = useRef(picking);
  useEffect(() => {
    if (wasPicking.current === picking) return;
    wasPicking.current = picking;
    if (!picking) return;
    const timer = setTimeout(() => {
      setSheet("min");
      setSelected(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [picking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSwitcherOpen(false);
      if (picking) nav.cancelPick();
      else setFullMap(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const setStartManual = (id: string | null) => {
    manualStart.current = id !== null;
    nav.setStart(id);
  };

  // ---- mobile sheet drag ---------------------------------------------------
  const shellRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const onHandleDown = (e: RPE) => {
    const el = sheetRef.current;
    if (!el) return;
    drag.current = { y: e.clientY, h: el.getBoundingClientRect().height, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: RPE) => {
    const d = drag.current;
    const shell = shellRef.current;
    if (!d || !shell) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    const max = shell.clientHeight * 0.9;
    setDragHeight(Math.max(120, Math.min(max, d.h + dy)));
  };
  const onHandleUp = () => {
    const d = drag.current;
    const shell = shellRef.current;
    drag.current = null;
    if (!d || !shell) return;
    if (!d.moved) {
      setSheet((s) => (s === "min" ? "mid" : s === "mid" ? "max" : "mid"));
      return;
    }
    const h = dragHeight ?? d.h;
    const H = shell.clientHeight;
    const snaps: [Sheet, number][] = [
      ["min", 150],
      ["mid", H * 0.48],
      ["max", H * 0.88],
    ];
    const nearest = snaps.reduce((a, b) => (Math.abs(b[1] - h) < Math.abs(a[1] - h) ? b : a));
    setSheet(nearest[0]);
    setDragHeight(null);
  };

  const candidateLabel = labelOf(candidate);
  const currentViewName =
    view === "campus"
      ? "Campus"
      : buildingDisplayName(names, view, BUILDING_TABS.find(([id]) => id === view)?.[1] ?? view);

  return (
    <div className={`${styles.shell} navShell ${fullMap ? `${styles.full} navFull` : ""}`} ref={shellRef}>
      {/* ---------------- map ---------------- */}
      <section className={styles.mapArea} aria-label="Campus map">
        <div className={styles.mapTop}>
          <div className={styles.switcher}>
            {view !== "campus" && (
              <button
                type="button"
                className={styles.switchBack}
                onClick={() => goTo({ kind: "campus" })}
                aria-label="Back to the campus map"
                title="Campus"
              >
                <Icon name="arrowLeft" size={18} />
              </button>
            )}
            <button
              type="button"
              className={styles.switchBtn}
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              aria-label={`Showing ${currentViewName}. Choose a building`}
            >
              <Icon name={view === "campus" ? "map" : "building"} size={16} />
              <span>{currentViewName}</span>
              <Icon name="chevronDown" size={16} />
            </button>
            {switcherOpen && (
              <>
                <div className={styles.scrim} onClick={() => setSwitcherOpen(false)} aria-hidden="true" />
                <div className={styles.switchMenu} role="menu">
                  {BUILDING_TABS.map(([id, fallback, f]) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={view === id}
                      className={`${styles.switchItem} ${view === id ? styles.switchOn : ""}`}
                      onClick={() => {
                        setSwitcherOpen(false);
                        goTo(f);
                      }}
                    >
                      <Icon name={id === "campus" ? "map" : "building"} size={16} />
                      <span>{id === "campus" ? "Campus map" : buildingDisplayName(names, id, fallback)}</span>
                      {view === id && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.mapCanvas}>
          <CampusMap
            hideSidebar
            start={picking ? candidate : start}
            dest={dest}
            onStartChange={setStartManual}
            onDestChange={nav.setDest}
            focus={focus}
            onViewChange={setView}
            onRoute={setRoute}
            onSelect={setSelected}
            onFloorChange={setViewFloor}
            onNamesChange={setNames}
            userPos={userPos}
            initialAdminTool={adminTool}
            focusPlace={placeFocus}
            routeNonce={routeNonce}
            picking={picking}
            onPick={nav.pick}
            hideBackButton
            extraMenuItems={[
              {
                label: fullMap ? "Exit full screen" : "Full-screen map",
                onSelect: () => setFullMap((f) => !f),
              },
            ]}
            insets={{
              top: 58,
              // Bottom cards (pick / tapped place / route) and the floor chip.
              bottom: picking || info ? (sheetLayout ? 170 : 140) : guide && !routeMin ? 120 : 56,
            }}
          />
        </div>

        {fullMap && !picking && (
          <button
            type="button"
            className={styles.askFab}
            onClick={() => {
              setFullMap(false);
              setTab("assistant");
            }}
          >
            <Icon name="sparkle" size={17} /> Ask ATLAS
          </button>
        )}

        {picking && (
          <div className={styles.pickBar} role="dialog" aria-label="Choose your starting point">
            <span className={styles.pickIcon} aria-hidden="true">
              <Icon name="locate" size={20} />
            </span>
            <div className={styles.pickText}>
              {candidate ? (
                <>
                  <strong>Start here?</strong>
                  <span>{candidateLabel}</span>
                </>
              ) : (
                <>
                  <strong>Where are you now?</strong>
                  <span>Tap your current location on the map. Tap a building to pick a room inside.</span>
                </>
              )}
            </div>
            <div className={styles.pickActions}>
              {candidate && (
                <button type="button" className={styles.btnPrimary} onClick={() => nav.confirmPick()}>
                  <Icon name="check" size={16} /> Confirm
                </button>
              )}
              <button type="button" className={styles.btnGhost} onClick={() => nav.cancelPick()}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {info && !picking && (
          <PlaceCard
            key={info.id}
            info={info}
            names={names}
            defaultOpen={!sheetLayout}
            isStart={start === info.id}
            isDest={dest === info.id}
            onClose={() => setSelected(null)}
            onDirections={() => {
              setSelected(null);
              setTab("assistant");
              chat.directionsTo(info.id, info.name);
            }}
            onStart={() => {
              setStartManual(info.id);
              setSelected(null);
            }}
            onDest={() => {
              nav.setDest(info.id);
              setSelected(null);
              if (!start) setTab("directions");
            }}
          />
        )}

        {guide && !info && !picking && routeMin && (
          <button type="button" className={styles.routePill} onClick={() => setRouteMin(false)}>
            <Icon name="route" size={16} /> {Math.round(guide.distance)} m · {guide.minutes} min
            <Icon name="chevronUp" size={16} />
          </button>
        )}

        {guide && !info && !picking && !routeMin && (
          <div className={styles.routeCard} role="region" aria-label="Current route">
            <div className={styles.routeTop}>
              <span className={styles.routeEnds}>
                <span className={`${styles.miniDot} ${styles.dotDest}`}>B</span>
                <span className={styles.routeName}>{labelOf(dest)}</span>
              </span>
              <span className={styles.routeStat}>
                {Math.round(guide.distance)} m · {guide.minutes} min
              </span>
              {guide.legs.length <= 1 && (
                <button
                  type="button"
                  className={styles.stepSteps}
                  onClick={() => {
                    setTab("directions");
                    setSheet("mid");
                  }}
                >
                  Steps
                </button>
              )}
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setRouteMin(true)}
                aria-label="Minimise route card"
                title="Minimise"
              >
                <Icon name="chevronDown" size={18} />
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  manualStart.current = false;
                  nav.clear();
                }}
                aria-label="End navigation"
                title="End navigation"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            {guide.legs.length > 1 && (
            <div className={styles.stepper} role="list" aria-label="Route, floor by floor">
              {guide.legs.map((l, i) => {
                const active =
                  l.building === null
                    ? view === "campus"
                    : view === l.building && (viewFloor ?? 1) === (l.floor ?? 1);
                return (
                  <Fragment key={i}>
                    {i > 0 && <Icon name="chevronDown" size={14} className={styles.stepArrow} />}
                    <button
                      type="button"
                      role="listitem"
                      className={`${styles.stepChip} ${active ? styles.stepOn : ""}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() =>
                        goTo(
                          l.building
                            ? { kind: "building", id: l.building, floor: l.floor ?? 1 }
                            : { kind: "campus" },
                        )
                      }
                    >
                      <Icon name={l.building ? "building" : "map"} size={14} />
                      <span>{l.label.replace(/^Campus grounds$/, "Outdoors")}</span>
                    </button>
                  </Fragment>
                );
              })}
              <button
                type="button"
                className={styles.stepSteps}
                onClick={() => {
                  setTab("directions");
                  setSheet("mid");
                }}
              >
                Steps
              </button>
            </div>
            )}
          </div>
        )}
      </section>

      {/* ---------------- panel / sheet ---------------- */}
      <aside
        ref={sheetRef}
        className={styles.panel}
        data-sheet={sheet}
        style={dragHeight ? { height: dragHeight, transition: "none" } : undefined}
        aria-label="Assistant and directions"
      >
        <div
          className={styles.handle}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          role="button"
          tabIndex={0}
          aria-label={sheet === "max" ? "Collapse panel" : "Expand panel"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSheet((s) => (s === "max" ? "mid" : "max"));
            }
          }}
        >
          <span />
        </div>

        <div className={`${styles.panelHead} ${sheetLayout && sheet === "min" ? styles.hidden : ""}`}>
          <div className={styles.segment} role="tablist" aria-label="Panel">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "assistant"}
              className={tab === "assistant" ? styles.segOn : ""}
              onClick={() => {
                setTab("assistant");
                if (sheet === "min") setSheet("mid");
              }}
            >
              <Icon name="sparkle" size={16} /> Assistant
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "directions"}
              className={tab === "directions" ? styles.segOn : ""}
              onClick={() => {
                setTab("directions");
                if (sheet === "min") setSheet("mid");
              }}
            >
              <Icon name="route" size={16} /> Directions
            </button>
          </div>
          {tab === "assistant" && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => chat.reset()}
              title="New conversation"
              aria-label="New conversation"
            >
              <Icon name="refresh" size={18} />
            </button>
          )}
        </div>

        <div className={styles.panelBody}>
          {tab === "assistant" ? (
            <div className={styles.assistantWrap}>
              <AssistantChat
                compact={sheetLayout && sheet === "min"}
                onExpand={() => setSheet("mid")}
                onMapRequest={() => setSheet("min")}
              />
            </div>
          ) : (
            <div className={styles.directions}>
              {status !== "uncalibrated" && (
                <p className={styles.status}>
                  <Icon name="info" size={15} /> {STATUS_TEXT[status]}
                </p>
              )}

              <div className={styles.planner}>
                <PlaceSelect
                  value={start}
                  onChange={setStartManual}
                  label="From"
                  tone="start"
                  groups={groups}
                  labelOf={labelOf}
                />
                <button
                  type="button"
                  className={styles.swapBtn}
                  onClick={() => nav.swap()}
                  disabled={!start && !dest}
                  aria-label="Swap start and destination"
                  title="Swap"
                >
                  <Icon name="swap" size={18} />
                </button>
                <PlaceSelect
                  value={dest}
                  onChange={nav.setDest}
                  label="To"
                  tone="dest"
                  groups={groups}
                  labelOf={labelOf}
                />
              </div>

              <div className={styles.plannerActions}>
                <button type="button" className={styles.btnGhost} onClick={() => nav.beginPick(dest)}>
                  <Icon name="locate" size={16} /> Pick start on map
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => {
                    manualStart.current = false;
                    nav.clear();
                    setSelected(null);
                  }}
                  disabled={!start && !dest}
                >
                  <Icon name="x" size={16} /> Clear
                </button>
              </div>

              {start && dest && !guide && (
                <p className={styles.warn} role="status">
                  No walkable route was found between these two places.
                </p>
              )}

              {guide && route && (
                <div className={styles.routeSummary} aria-live="polite">
                  <div className={styles.summaryTop}>
                    <div>
                      <div className={styles.big}>{Math.round(guide.distance)} m</div>
                      <div className={styles.summaryMeta}>
                        <Icon name="clock" size={14} /> about {guide.minutes} min walk
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        nav.showRoute(start!, dest!);
                        setSheet("min");
                      }}
                    >
                      <Icon name="map" size={16} /> Show route
                    </button>
                  </div>

                  <ol className={styles.steps}>
                    {guide.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {!start && !dest && (
                <div className={styles.empty}>
                  <Icon name="compass" size={28} />
                  <p>
                    Choose a starting point and destination, tap places on the map, or ask the
                    assistant — e.g. <em>“How do I get to the Library?”</em>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

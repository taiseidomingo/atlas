"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as RPE,
  type ReactNode,
} from "react";
import styles from "./CampusMap.module.css";

/**
 * Pan / zoom viewport for the map.
 *
 * The content is laid out at the largest 16:9 box that fits ("base" size),
 * then scaled as a whole, so proportions and coordinates never change.
 * Mouse drag, touch drag, pinch, wheel and double-click all work.
 *
 * Views are described as frames, in map fractions and on-screen pixels:
 *   - point: centre a spot with the map drawn `width` pixels wide;
 *   - box:   fit an area (a route) as large as possible, up to `maxWidth`;
 *   - fit:   the whole map.
 * `home` is the navigation-focused view for the current map (shown on load
 * and by "recentre"); `target` flies somewhere once (chatbot, routes).
 * `insets` are screen edges covered by overlays, kept out of the framing.
 *
 * The current scale is published as the CSS variable --zoom on the content,
 * so markers can stay the same size on screen while the map scales.
 */

const MAX_SCALE = 14;
type View = { s: number; x: number; y: number };
type Pt = { x: number; y: number };

/**
 * How wide the whole map is drawn, in CSS pixels: at least `px`, and at
 * least `perScreen` times the map area's width (bigger screens show more).
 */
export type MapWidth = { px: number; perScreen: number };

export type MapFrame =
  | { kind: "point"; fx: number; fy: number; width: MapWidth }
  | {
      kind: "box";
      box: { x0: number; y0: number; x1: number; y1: number };
      /** Never zoom in further than this. */
      maxWidth: MapWidth;
    }
  /**
   * Fill the uncovered area (no empty margins), centred on a spot; then
   * zoomed in to at least `minWidth` and out to at most `maxWidth`.
   */
  | {
      kind: "cover";
      fx: number;
      fy: number;
      minWidth?: MapWidth;
      maxWidth?: MapWidth;
      /** Show the top of the map first when it is taller than the screen. */
      alignTop?: boolean;
    }
  | { kind: "fit" };

export interface ZoomTarget {
  /** Map (resetKey) the target belongs to; applied once that map is shown. */
  key: string;
  nonce: number;
  frame: MapFrame;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** A secondary map action, listed in the controls' "more" menu. */
export interface MapMenuItem {
  label: string;
  onSelect: () => void;
  /** Shown as a check mark (toggles such as rotation or the legend). */
  active?: boolean;
}

/** Base (unscaled) pixel width of the map content; used to size markers. */
export const MapScaleContext = createContext<{ baseWidth: number }>({ baseWidth: 1000 });
export const useMapScale = () => useContext(MapScaleContext);

/** Largest box of the given aspect ratio that fits in w × h. */
function fitBox(w: number, h: number, aspect: number) {
  const bw = Math.max(1, Math.min(w, h * aspect));
  return { w: bw, h: bw / aspect };
}

export default function ZoomPan({
  resetKey,
  target,
  home: homeFrame,
  insets = NO_INSETS,
  aspect = 16 / 9,
  menuItems = [],
  children,
}: {
  /** Current map; null while switching maps (the view is held). */
  resetKey: string | null;
  target?: ZoomTarget | null;
  home?: MapFrame;
  insets?: Insets;
  /** Width / height of the content (changes with the map shown). */
  aspect?: number;
  /** Secondary actions for the "more" menu (whole map is always there). */
  menuItems?: MapMenuItem[];
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  // Close the "more" menu on any tap outside it, or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!controlsRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{
    start: Pt;
    view: View;
    dist: number;
    mid: Pt;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const appliedTarget = useRef<number | null>(null);
  const shownKey = useRef<string | null>(null);
  const homeRef = useRef<MapFrame>(homeFrame ?? { kind: "fit" });
  const insetsRef = useRef(insets);
  const aspectRef = useRef(aspect);
  useLayoutEffect(() => {
    homeRef.current = homeFrame ?? { kind: "fit" };
    insetsRef.current = insets;
    aspectRef.current = aspect;
  });

  // Reads the latest aspect, so long-lived handlers (resize) stay correct
  // when the map switches between campus, floors and rotated floors.
  const base = useCallback((w: number, h: number) => fitBox(w, h, aspectRef.current), []);

  const clamp = useCallback(
    (v: View): View => {
      const { w: vw, h: vh } = sizeRef.current;
      const b = base(vw, vh);
      const s = Math.min(MAX_SCALE, Math.max(1, v.s));
      const W = b.w * s;
      const H = b.h * s;
      const x = W <= vw ? (vw - W) / 2 : Math.min(0, Math.max(vw - W, v.x));
      const y = H <= vh ? (vh - H) / 2 : Math.min(0, Math.max(vh - H, v.y));
      return { s, x, y };
    },
    [base],
  );

  const commit = useCallback(
    (v: View, smooth = false) => {
      const next = clamp(v);
      viewRef.current = next;
      setAnimate(smooth);
      setView(next);
    },
    [clamp],
  );

  /** The view showing a frame inside the uncovered part of the screen. */
  const frameView = useCallback(
    (frame: MapFrame): View => {
      const { w: vw, h: vh } = sizeRef.current;
      const b = base(vw, vh);
      const ins = insetsRef.current;
      // Area not hidden by overlays (never smaller than half the screen).
      const aw = Math.max(vw * 0.5, vw - ins.left - ins.right);
      const ah = Math.max(vh * 0.5, vh - ins.top - ins.bottom);
      const ax = vw - aw === 0 ? 0 : Math.min(ins.left, vw - aw);
      const ay = vh - ah === 0 ? 0 : Math.min(ins.top, vh - ah);
      const px = (w: MapWidth) => Math.max(w.px, vw * w.perScreen);
      let s = 1;
      let cx = b.w / 2;
      let cy = b.h / 2;
      if (frame.kind === "point") {
        s = px(frame.width) / b.w;
        cx = frame.fx * b.w;
        cy = frame.fy * b.h;
      } else if (frame.kind === "cover") {
        s = Math.max(aw / b.w, ah / b.h);
        if (frame.maxWidth) s = Math.min(s, px(frame.maxWidth) / b.w);
        if (frame.minWidth) s = Math.max(s, px(frame.minWidth) / b.w);
        cx = frame.fx * b.w;
        cy = frame.fy * b.h;
        if (frame.alignTop && b.h * Math.min(MAX_SCALE, Math.max(1, s)) > ah) {
          const sc = Math.min(MAX_SCALE, Math.max(1, s));
          return { s: sc, x: ax + aw / 2 - cx * sc, y: ay };
        }
      } else if (frame.kind === "box") {
        const bw = Math.max(0.01, frame.box.x1 - frame.box.x0) * b.w;
        const bh = Math.max(0.01, frame.box.y1 - frame.box.y0) * b.h;
        s = Math.min(aw / bw, ah / bh, px(frame.maxWidth) / b.w);
        cx = ((frame.box.x0 + frame.box.x1) / 2) * b.w;
        cy = ((frame.box.y0 + frame.box.y1) / 2) * b.h;
      } else {
        return { s: 1, x: (vw - b.w) / 2, y: (vh - b.h) / 2 };
      }
      s = Math.min(MAX_SCALE, Math.max(1, s));
      return { s, x: ax + aw / 2 - cx * s, y: ay + ah / 2 - cy * s };
    },
    [base],
  );

  const home = useCallback(() => frameView(homeRef.current), [frameView]);

  const applyTarget = useCallback(
    (t: ZoomTarget) => {
      const { w: vw, h: vh } = sizeRef.current;
      if (vw === 0 || vh === 0) return false;
      commit(frameView(t.frame), true);
      return true;
    },
    [commit, frameView],
  );

  // Track the viewport size; keep the same map point centred on resize.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      const prev = sizeRef.current;
      if (next.w === prev.w && next.h === prev.h) return;
      const v = viewRef.current;
      const pb = base(prev.w, prev.h);
      sizeRef.current = next;
      setSize(next);
      if (prev.w === 0 || prev.h === 0) {
        commit(home());
        shownKey.current = null;
        return;
      }
      const nb = base(next.w, next.h);
      // Map point at the old centre, as a fraction of the content.
      const fx = (prev.w / 2 - v.x) / (pb.w * v.s);
      const fy = (prev.h / 2 - v.y) / (pb.h * v.s);
      commit({ s: v.s, x: next.w / 2 - fx * nb.w * v.s, y: next.h / 2 - fy * nb.h * v.s });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New map (campus / another floor): show its home view, or the pending target.
  useEffect(() => {
    if (size.w === 0 || resetKey === null) return;
    const pending = target && target.key === resetKey && appliedTarget.current !== target.nonce;
    if (pending && target) {
      if (applyTarget(target)) appliedTarget.current = target.nonce;
      shownKey.current = resetKey;
      return;
    }
    if (shownKey.current !== resetKey) {
      shownKey.current = resetKey;
      commit(home());
    }
  }, [resetKey, target, size.w, applyTarget, commit, home]);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomAt = useCallback(
    (factor: number, at?: Pt, smooth = true) => {
      const { w: vw, h: vh } = sizeRef.current;
      const v = viewRef.current;
      const s = Math.min(MAX_SCALE, Math.max(1, v.s * factor));
      const k = s / v.s;
      const c = at ?? { x: vw / 2, y: vh / 2 };
      commit({ s, x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k }, smooth);
    },
    [commit],
  );

  // Wheel / trackpad zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0022)), at, false);
      } else {
        const v = viewRef.current;
        commit({ s: v.s, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, commit]);

  const begin = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = {
        start: pts[0],
        view: viewRef.current,
        dist: 0,
        mid: pts[0],
        moved: gesture.current?.moved ?? false,
      };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = {
        start: a,
        view: viewRef.current,
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        moved: true,
      };
    }
  };

  const down = (e: RPE) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, local(e));
    begin();
  };

  const move = (e: RPE) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(MAX_SCALE, Math.max(1, (g.view.s * dist) / g.dist));
      const k = s / g.view.s;
      commit({
        s,
        x: mid.x - (g.mid.x - g.view.x) * k,
        y: mid.y - (g.mid.y - g.view.y) * k,
      });
      return;
    }
    const dx = pts[0].x - g.start.x;
    const dy = pts[0].y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    if (!g.moved) {
      g.moved = true;
      setDragging(true);
      viewport.current?.setPointerCapture?.(e.pointerId);
    }
    commit({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy });
  };

  const up = (e: RPE) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      suppressClick.current = gesture.current?.moved ?? false;
      window.setTimeout(() => (suppressClick.current = false), 60);
      gesture.current = null;
      setDragging(false);
    } else {
      begin();
    }
  };

  const b = fitBox(size.w, size.h, aspect);

  return (
    <MapScaleContext.Provider value={{ baseWidth: b.w }}>
      <div
        ref={viewport}
        className={`${styles.zoomViewport} ${dragging ? styles.grabbing : ""}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={(e) => {
          if ((e.target as Element).closest?.("[role=button]")) return;
          zoomAt(1.8, local(e));
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        <div
          className={`${styles.zoomContent} ${animate ? styles.smooth : ""}`}
          style={
            {
              width: b.w,
              height: b.h,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
              "--zoom": view.s,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>
      <div className={styles.zoomControls} role="group" aria-label="Map controls" ref={controlsRef}>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomAt(1.6)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomAt(1 / 1.6)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label="Recentre on your route or destination"
          title="Recentre"
          onClick={() => commit(home(), true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 2v4 M12 18v4 M2 12h4 M18 12h4" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          aria-label="More map options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h.01 M12 12h.01 M19 12h.01" strokeWidth={3.2} />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className={styles.mapMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.mapMenuItem}
                onClick={() => {
                  setMenuOpen(false);
                  commit(frameView({ kind: "fit" }), true);
                }}
              >
                <span>Show whole map</span>
              </button>
              {menuItems.map((item: MapMenuItem) => (
                <button
                  key={item.label}
                  type="button"
                  role={item.active === undefined ? "menuitem" : "menuitemcheckbox"}
                  aria-checked={item.active}
                  className={styles.mapMenuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    item.onSelect();
                  }}
                >
                  <span>{item.label}</span>
                  {item.active && (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12.5 10 17.5 19.5 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </MapScaleContext.Provider>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPE,
  type ReactNode,
} from "react";
import styles from "./CampusMap.module.css";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
type View = { s: number; x: number; y: number };
type Pt = { x: number; y: number };
const HOME: View = { s: 1, x: 0, y: 0 };

export default function ZoomPan({
  enabled,
  resetKey,
  children,
}: {
  enabled: boolean;
  resetKey: string;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [dragging, setDragging] = useState(false);
  const [prevKey, setPrevKey] = useState(resetKey);
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{
    start: Pt;
    view: View;
    dist: number;
    mid: Pt;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setView(HOME);
  }
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  const clamp = useCallback((v: View): View => {
    const el = viewport.current;
    if (!el) return v;
    const s = clampScale(v.s);
    return {
      s,
      x: Math.min(0, Math.max(el.clientWidth * (1 - s), v.x)),
      y: Math.min(0, Math.max(el.clientHeight * (1 - s), v.y)),
    };
  }, []);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomBy = (factor: number) => {
    const el = viewport.current;
    if (!el) return;
    const v = viewRef.current;
    const s = clampScale(v.s * factor);
    const k = s / v.s;
    const c = { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    setView(clamp({ s, x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k }));
  };

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
      const s = clampScale((g.view.s * dist) / g.dist);
      const k = s / g.view.s;
      setDragging(true);
      setView(
        clamp({
          s,
          x: mid.x - (g.mid.x - g.view.x) * k,
          y: mid.y - (g.mid.y - g.view.y) * k,
        }),
      );
      return;
    }
    const dx = pts[0].x - g.start.x;
    const dy = pts[0].y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (g.view.s > 1.01) {
      setDragging(true);
      setView(clamp({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }));
    }
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

  const handlers = enabled
    ? {
        onPointerDown: down,
        onPointerMove: move,
        onPointerUp: up,
        onPointerCancel: up,
        onClickCapture: (e: React.MouseEvent) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        },
      }
    : {};

  return (
    <>
      <div
        ref={viewport}
        className={enabled ? styles.zoomViewport : styles.zoomOff}
        style={
          enabled
            ? { touchAction: view.s > 1.01 ? "none" : "pan-y" }
            : undefined
        }
        {...handlers}
      >
        <div
          className={
            enabled
              ? `${styles.zoomContent} ${dragging ? "" : styles.smooth}`
              : styles.zoomOff
          }
          style={
            enabled
              ? {
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
      {enabled && (
        <div className={styles.zoomControls} role="group" aria-label="Map zoom">
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Zoom in"
            onClick={() => zoomBy(1.5)}
          >
            +
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.5)}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Reset view"
            onClick={() => setView(HOME)}
          >
            ⤢
          </button>
        </div>
      )}
    </>
  );
}

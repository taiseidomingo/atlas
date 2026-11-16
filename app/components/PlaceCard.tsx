"use client";

import { useState } from "react";
import type { PlaceInfo } from "@/lib/placeInfo";
import styles from "./NavigationView.module.css";

interface Props {
  info: PlaceInfo;
  isStart: boolean;
  isDest: boolean;
  onStart: () => void;
  onDest: () => void;
  onClose: () => void;
  onViewBuilding?: () => void;
}

function Photo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={styles.photoEmpty}>
        <span>📷</span>
        <small>No photo yet</small>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className={styles.photo}
      onError={() => setFailed(true)}
    />
  );
}

export default function PlaceCard({
  info,
  isStart,
  isDest,
  onStart,
  onDest,
  onClose,
  onViewBuilding,
}: Props) {
  return (
    <aside className={`card ${styles.placeCard}`} aria-label={info.name}>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>
      <div className={styles.photos}>
        {info.photos.map((src) => (
          <Photo key={src} src={src} />
        ))}
      </div>
      <h2 className={styles.placeName}>{info.name}</h2>
      <div className={styles.placeMeta}>
        {info.type} · {info.place}
      </div>
      <p className={styles.placeDesc}>{info.description}</p>
      <div className={styles.placeActions}>
        <button
          type="button"
          className={isStart ? "btn" : "btnGhost"}
          onClick={onStart}
        >
          {isStart ? "✓ Start" : "Set as start"}
        </button>
        <button
          type="button"
          className={isDest ? "btn" : "btnGhost"}
          onClick={onDest}
        >
          {isDest ? "✓ Destination" : "Set as destination"}
        </button>
      </div>
      {onViewBuilding && (
        <button
          type="button"
          className="btnGhost"
          style={{ marginTop: 8, width: "100%" }}
          onClick={onViewBuilding}
        >
          View on floor plan
        </button>
      )}
    </aside>
  );
}

"use client";

import { useState } from "react";
import { campusGraph } from "@/lib/graph";
import { findShortestPath } from "@/lib/pathfinding";

export default function NavigationPanel() {
  const [from, setFrom] = useState("A");
  const [to, setTo] = useState("C");
  const [result, setResult] =
    useState<ReturnType<typeof findShortestPath>>(null);

  function handleFindPath() {
    setResult(findShortestPath(campusGraph, from, to));
  }

  return (
    <div>
      <h2>Navigation</h2>

      <select value={from} onChange={(e) => setFrom(e.target.value)}>
        {campusGraph.nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      {" -> "}

      <select value={to} onChange={(e) => setTo(e.target.value)}>
        {campusGraph.nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <button onClick={handleFindPath} style={{ marginLeft: 8 }}>
        Find path
      </button>

      {result && (
        <p>
          Path: {result.path.join(" -> ")} (distance: {result.distance})
        </p>
      )}

      {result === null && <p>No path found between those rooms.</p>}
    </div>
  );
}

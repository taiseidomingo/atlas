import { campusGraph } from "@/lib/graph";
import { findShortestPath } from "@/lib/pathfinding";

export default function Home() {
  const result = findShortestPath(campusGraph, "B", "D");

  return (
    <main>
      <h1> ATLAS </h1>
      {result ? (
        <p>
          Shortest path : {result.path.join(" \u2192 ")} (distance:{" "}
          {result.distance})
        </p>
      ) : (
        <p> No path found. </p>
      )}
    </main>
  );
}

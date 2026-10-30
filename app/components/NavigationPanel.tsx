"use client";

import { useState, useMemo, useEffect } from "react";
import { campusGraph } from "@/lib/graph";
import { findShortestPath } from "@/lib/pathfinding";

import imgCampus from "../assets/campus.png";
import imgNb1 from "../assets/nb1.png";
import imgNb2 from "../assets/nb2.png";
import imgNb3 from "../assets/nb3.png";
import imgNb4 from "../assets/nb4.png";
import imgNb5 from "../assets/nb5.png";
import imgOb1 from "../assets/ob1.png";
import imgOb2 from "../assets/ob2.png";

type ViewState = "campus" | "NB" | "OB";

const MAP_IMAGES: Record<string, any> = {
  campus: imgCampus,
  "NB-1": imgNb1,
  "NB-2": imgNb2,
  "NB-3": imgNb3,
  "NB-4": imgNb4,
  "NB-5": imgNb5,
  "OB-1": imgOb1,
  "OB-2": imgOb2,
};

export default function NavigationPanel() {
  const [view, setView] = useState<ViewState>("campus");
  const [floor, setFloor] = useState<number>(1);

  const [startNode, setStartNode] = useState<string | null>(null);
  const [destNode, setDestNode] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<ReturnType<
    typeof findShortestPath
  > | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredBuilding, setHoveredBuilding] = useState<"NB" | "OB" | null>(
    null,
  );

  // --- DEV MODE STATES ---
  const [isDevMode, setIsDevMode] = useState(false);
  const [devClickCoords, setDevClickCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (startNode && destNode) {
      setPathResult(findShortestPath(campusGraph, startNode, destNode));
    } else {
      setPathResult(null);
    }
  }, [startNode, destNode]);

  useEffect(() => {
    setHoveredBuilding(null);
  }, [view]);

  const availableFloors = useMemo(() => {
    if (view === "campus") return [];
    const floors = new Set<number>();
    campusGraph.nodes.forEach((n) => {
      if (n.id.startsWith(view) && n.floor !== undefined) {
        floors.add(n.floor);
      }
    });
    return Array.from(floors).sort((a, b) => a - b);
  }, [view]);

  const visibleNodes = useMemo(() => {
    if (view === "campus")
      return campusGraph.nodes.filter((n) => n.floor === undefined);
    return campusGraph.nodes.filter(
      (n) => n.id.startsWith(view) && n.floor === floor,
    );
  }, [view, floor]);

  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    return campusGraph.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to),
    );
  }, [visibleNodes]);

  const currentImageKey = view === "campus" ? "campus" : `${view}-${floor}`;
  const backgroundImage = MAP_IMAGES[currentImageKey];

  const viewBoxConfig = "0 0 1080 1920";

  const ROOM_W = 90;
  const ROOM_H = 40;

  // --- CORE LOGIC FOR CLICKING THE MAP ---
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDevMode) {
      // 1. Get the SVG element
      const svg = e.currentTarget;
      // 2. Create an SVG Point based on the mouse click
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      // 3. Transform screen coordinates to SVG viewBox coordinates (0 to 1080, 0 to 1920)
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      setDevClickCoords({ x: Math.round(svgP.x), y: Math.round(svgP.y) });
    } else {
      setSelectedNodeId(null);
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    if (isDevMode) return; // Disable room clicking in dev mode
    e.stopPropagation();
    setSelectedNodeId(nodeId);
  };

  const setAsStart = () => {
    if (selectedNodeId) setStartNode(selectedNodeId);
  };
  const setAsDest = () => {
    if (selectedNodeId) setDestNode(selectedNodeId);
  };
  const clearPins = () => {
    setStartNode(null);
    setDestNode(null);
    setSelectedNodeId(null);
  };

  const getNode = (id: string) => campusGraph.nodes.find((n) => n.id === id);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "sans-serif",
      }}
    >
      {/* Top Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {view === "campus" ? (
          <h2>Campus Overview</h2>
        ) : (
          <>
            <button onClick={() => setView("campus")} style={btnStyle}>
              ← Back to Campus
            </button>
            <h2>{view === "NB" ? "New Building" : "Old Building"}</h2>
            <div style={{ display: "flex", gap: 4 }}>
              {availableFloors.map((f) => (
                <button
                  key={f}
                  onClick={() => setFloor(f)}
                  style={{
                    ...btnStyle,
                    background: floor === f ? "#0070f3" : "#eee",
                    color: floor === f ? "white" : "black",
                  }}
                >
                  {f}F
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* DEV MODE BUTTON */}
          <button
            onClick={() => {
              setIsDevMode(!isDevMode);
              setDevClickCoords(null);
            }}
            style={{
              ...btnStyle,
              background: isDevMode ? "#ffeb3b" : "white",
              borderColor: isDevMode ? "#fbc02d" : "#ccc",
            }}
          >
            {isDevMode ? "Dev Mode: ON" : "Dev Mode: OFF"}
          </button>
          <button onClick={clearPins} style={btnStyle}>
            Clear Pins
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "500px",
          height: "75vh",
          background: "#f0f4f8",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid #ddd",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          margin: "0 auto",
        }}
      >
        <svg
          viewBox={viewBoxConfig}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: "100%",
            height: "100%",
            cursor: isDevMode
              ? "crosshair"
              : view === "campus" && hoveredBuilding
                ? "pointer"
                : "default",
          }}
          onClick={handleMapClick}
        >
          {backgroundImage && (
            <image
              key={currentImageKey}
              href={backgroundImage.src}
              width="1080"
              height="1920"
              preserveAspectRatio="xMidYMid meet"
              style={{ animation: "zoomFade 0.4s ease-out forwards" }}
            />
          )}

          {/* CLICKABLE BUILDING OVERLAYS */}
          {view === "campus" && !isDevMode && (
            <>
              {/* New Building Area */}
              <rect
                x="828"
                y="453"
                width="250"
                height="1080"
                fill={
                  hoveredBuilding === "NB"
                    ? "rgba(0, 112, 243, 0.2)"
                    : "transparent"
                }
                stroke={hoveredBuilding === "NB" ? "#0070f3" : "transparent"}
                strokeWidth="4"
                style={{ transition: "all 0.2s" }}
                onMouseEnter={() => setHoveredBuilding("NB")}
                onMouseLeave={() => setHoveredBuilding(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setView("NB");
                  setFloor(1);
                }}
              />

              {/* Old Building Area */}
              <rect
                x="190"
                y="735"
                width="300"
                height="580"
                fill={
                  hoveredBuilding === "OB"
                    ? "rgba(255, 100, 0, 0.2)"
                    : "transparent"
                }
                stroke={hoveredBuilding === "OB" ? "#ff6400" : "transparent"}
                strokeWidth="4"
                style={{ transition: "all 0.2s" }}
                onMouseEnter={() => setHoveredBuilding("OB")}
                onMouseLeave={() => setHoveredBuilding(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setView("OB");
                  setFloor(1);
                }}
              />
            </>
          )}

          {/* Nodes & Paths */}
          <g style={{ pointerEvents: isDevMode ? "none" : "auto" }}>
            {visibleEdges.map((edge, i) => {
              const a = getNode(edge.from);
              const b = getNode(edge.to);
              if (!a || !b) return null;

              const isPathEdge =
                pathResult?.path.includes(edge.from) &&
                pathResult?.path.includes(edge.to);

              return (
                <line
                  key={`edge-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isPathEdge ? "#ff0000" : "rgba(0,0,0,0.2)"}
                  strokeWidth={isPathEdge ? 8 : 3}
                  strokeDasharray={isPathEdge ? "none" : "8 8"}
                />
              );
            })}

            {visibleNodes.map((node) => {
              const isStart = startNode === node.id;
              const isDest = destNode === node.id;
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isJunction = node.kind === "junction";

              if (
                view === "campus" &&
                !isJunction &&
                (node.id.startsWith("NB") || node.id.startsWith("OB"))
              )
                return null;

              if (isJunction) {
                return (
                  <g
                    key={node.id}
                    onClick={(e) => handleNodeClick(node.id, e)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={node.x} cy={node.y} r={20} fill="transparent" />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={10}
                      fill={isSelected ? "#0070f3" : "#888"}
                      opacity={isHovered ? 0.9 : 0.4}
                      style={{ transition: "all 0.2s" }}
                    />
                  </g>
                );
              }

              return (
                <g
                  key={node.id}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={node.x - ROOM_W / 2}
                    y={node.y - ROOM_H / 2}
                    width={ROOM_W}
                    height={ROOM_H}
                    rx={6}
                    fill={
                      isHovered || isSelected
                        ? "rgba(0, 112, 243, 0.5)"
                        : "rgba(0, 112, 243, 0.15)"
                    }
                    stroke={isSelected ? "#0070f3" : "rgba(0, 112, 243, 0.6)"}
                    strokeWidth={isSelected ? 4 : 2}
                    style={{ transition: "all 0.2s" }}
                  />

                  <text
                    x={node.x}
                    y={node.y + 6}
                    textAnchor="middle"
                    fontSize={16}
                    fill="#000"
                    pointerEvents="none"
                    style={{
                      userSelect: "none",
                      fontWeight: isSelected ? "bold" : "normal",
                    }}
                  >
                    {node.name.split("(")[0].trim()}
                  </text>

                  {isStart && (
                    <g transform={`translate(${node.x}, ${node.y})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={35}
                        fill="rgba(0, 255, 0, 0.3)"
                        stroke="green"
                        strokeWidth={4}
                      />
                      <text
                        x={0}
                        y={8}
                        textAnchor="middle"
                        fontSize={18}
                        fontWeight="bold"
                        fill="green"
                      >
                        START
                      </text>
                    </g>
                  )}

                  {isDest && (
                    <g transform={`translate(${node.x}, ${node.y})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={35}
                        fill="rgba(255, 0, 0, 0.3)"
                        stroke="red"
                        strokeWidth={4}
                      />
                      <text
                        x={0}
                        y={8}
                        textAnchor="middle"
                        fontSize={18}
                        fontWeight="bold"
                        fill="red"
                      >
                        END
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* DEV MODE CROSSHAIR & COORDINATES */}
          {isDevMode && devClickCoords && (
            <g>
              {/* Crosshair */}
              <line
                x1={devClickCoords.x}
                y1="0"
                x2={devClickCoords.x}
                y2="1920"
                stroke="red"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1={devClickCoords.y}
                x2="1080"
                y2={devClickCoords.y}
                stroke="red"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle
                cx={devClickCoords.x}
                cy={devClickCoords.y}
                r="10"
                fill="red"
              />

              {/* Tooltip */}
              <rect
                x={devClickCoords.x + 15}
                y={devClickCoords.y - 25}
                width="160"
                height="40"
                fill="white"
                stroke="red"
                rx="4"
              />
              <text
                x={devClickCoords.x + 25}
                y={devClickCoords.y}
                fontSize="20"
                fill="red"
                fontWeight="bold"
              >
                X: {devClickCoords.x}, Y: {devClickCoords.y}
              </text>
            </g>
          )}
        </svg>

        {/* Selected Node Info Panel */}
        {selectedNode && !isDevMode && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              background: "white",
              padding: 16,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>{selectedNode.name}</h4>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={setAsStart}
                style={{
                  ...btnStyle,
                  borderColor: "green",
                  color: "green",
                  fontWeight: "bold",
                }}
              >
                Set Start
              </button>
              <button
                onClick={setAsDest}
                style={{
                  ...btnStyle,
                  borderColor: "red",
                  color: "red",
                  fontWeight: "bold",
                }}
              >
                Set Destination
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Route Details */}
      <div
        style={{
          padding: 16,
          background: "#f9f9f9",
          borderRadius: 8,
          minHeight: 80,
          border: "1px solid #eee",
          maxWidth: "500px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {isDevMode ? (
          <p
            style={{
              margin: 0,
              color: "#d32f2f",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            DEV MODE ACTIVE: Click anywhere on the image to get its X and Y
            coordinates.
          </p>
        ) : startNode || destNode ? (
          <div>
            <p style={{ margin: 0, fontSize: 14 }}>
              <strong style={{ color: "green" }}>Start:</strong>{" "}
              {startNode ? getNode(startNode)?.name : "Not set"} <br />
              <strong style={{ color: "red" }}>Destination:</strong>{" "}
              {destNode ? getNode(destNode)?.name : "Not set"}
            </p>
            {pathResult ? (
              <p
                style={{
                  margin: "12px 0 0 0",
                  color: "#0070f3",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Distance: {pathResult.distance.toFixed(1)} meters.
              </p>
            ) : (
              pathResult === null &&
              startNode &&
              destNode && (
                <p
                  style={{
                    color: "red",
                    margin: "8px 0 0 0",
                    fontWeight: "bold",
                  }}
                >
                  No path found.
                </p>
              )
            )}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#666", textAlign: "center" }}>
            {view === "campus"
              ? "Click a building to enter."
              : "Click the blue boxes to select a room."}
          </p>
        )}
      </div>

      <style>{`
        @keyframes zoomFade {
          0% { opacity: 0; transform: scale(1.05); transform-origin: center; }
          100% { opacity: 1; transform: scale(1); transform-origin: center; }
        }
      `}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.2s",
};

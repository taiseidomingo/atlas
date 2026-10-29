"use client";

import { useState } from "react";
import { campusGraph } from "@/lib/graph";

export default function ClaimPanel() {
  const rawRooms = campusGraph.nodes.filter((n) => n.claimable);
  const rooms = Array.from(
    new Map(rawRooms.map((item) => [item.id, item])).values(),
  );

  const [nodeId, setNodeId] = useState(rooms[0]?.id ?? "");
  const [claimedBy, setClaimedBy] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClaim() {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/rooms/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, claimedBy, adminKey }),
      });

      const data = await response.json();

      setStatus(
        response.ok
          ? `${data.reservation.roomName} claimed by ${data.reservation.professor}`
          : (data.error ?? "Unable to claim room."),
      );
    } catch {
      setStatus("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Room claiming</h2>

      <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
        {rooms.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <input
        value={claimedBy}
        onChange={(e) => setClaimedBy(e.target.value)}
        placeholder="Professor name"
        style={{ marginLeft: 8 }}
      />

      <input
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        placeholder="Admin key"
        type="password"
        style={{ marginLeft: 8 }}
      />

      <button
        onClick={handleClaim}
        disabled={loading || !claimedBy.trim() || !adminKey}
        style={{ marginLeft: 8 }}
      >
        {loading ? "Claiming..." : "Claim"}
      </button>

      {status && <p>{status}</p>}
    </div>
  );
}

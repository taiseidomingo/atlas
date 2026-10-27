"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import NavigationPanel from "./components/NavigationPanel";
import ChatbotPanel from "./components/ChatbotPanel";
import ClaimPanel from "./components/ClaimPanel";

type Mode = "navigation" | "chatbot" | "claim";

export default function HomePage() {
  const isOnline = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);

      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [locationError, setLocationError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("navigation");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => setLocationError(error.message),
    );
  }, []);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 640,
      }}
    >
      <h1>Atlas</h1>

      <p>Connection: {isOnline ? "online" : "offline"}</p>

      <p>
        Location:{" "}
        {location
          ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
          : (locationError ?? "requesting...")}
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button onClick={() => setMode("navigation")}>Navigation</button>

        <button onClick={() => setMode("chatbot")}>Chatbot</button>

        <button onClick={() => setMode("claim")}>Room claiming</button>
      </div>

      {mode === "navigation" && <NavigationPanel />}
      {mode === "chatbot" && <ChatbotPanel />}
      {mode === "claim" && <ClaimPanel />}
    </main>
  );
}

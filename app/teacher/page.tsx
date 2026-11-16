"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface Room {
  id: string;
  name: string;
  place: string;
}

export default function TeacherPage() {
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const loadClaims = useCallback(async () => {
    const res = await fetch("/api/rooms/claim");
    const data = await res.json().catch(() => ({}));
    const next: Record<string, string> = {};
    (data.reservations ?? []).forEach(
      (r: { nodeId: string; professor: string }) => {
        next[r.nodeId] = r.professor;
      },
    );
    setClaims(next);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/session");
      if (!res.ok) throw new Error("session");
      const data = await res.json();
      setTeacher(data.teacher ?? null);
      setDemo(!!data.demo);
      setRooms(data.rooms ?? []);
      if (data.teacher) await loadClaims();
    } catch {
      setError(
        "Couldn't reach the server. Check that npm run dev is running, then refresh.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadClaims]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Login failed.");
    setPin("");
    await loadSession();
  };

  const logout = async () => {
    await fetch("/api/teacher/logout", { method: "POST" });
    setTeacher(null);
    setRooms([]);
  };

  const toggle = async (room: Room) => {
    setError("");
    const mine = claims[room.id] === teacher;
    const res = await fetch("/api/rooms/claim", {
      method: mine ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: room.id }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      if (res.status === 401) setTeacher(null);
    }
    await loadClaims();
  };

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, Room[]>();
    rooms
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .forEach((r) => map.set(r.place, [...(map.get(r.place) ?? []), r]));
    return Array.from(map.entries());
  }, [rooms, filter]);

  if (loading)
    return (
      <p className="sub" style={{ textAlign: "center", marginTop: 48 }}>
        Loading…
      </p>
    );

  if (!teacher) {
    return (
      <form
        className="card"
        onSubmit={login}
        style={{ maxWidth: 400, margin: "48px auto", display: "grid", gap: 12 }}
      >
        <h1 className="pageTitle">Teacher Login</h1>
        <p className="sub" style={{ margin: 0 }}>
          Sign in to claim the room you're in, so students can find you.
        </p>
        <input
          className="input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="username"
        />
        <input
          className="input"
          type="password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <div style={{ color: "var(--danger)", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}
        <button className="btn" disabled={!name || !pin}>
          Log in
        </button>
        {demo && (
          <small style={{ color: "var(--muted)" }}>
            Dev demo: Demo Professor / 1234
          </small>
        )}
      </form>
    );
  }

  const mine = rooms.filter((r) => claims[r.id] === teacher);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="pageTitle">Teacher Portal</h1>
          <p className="sub">
            Signed in as <strong>{teacher}</strong>
            {mine.length > 0
              ? ` · currently in ${mine.map((r) => r.name).join(", ")}`
              : " · no room claimed"}
          </p>
        </div>
        <button className="btnGhost" onClick={logout}>
          Log out
        </button>
      </div>

      <input
        className="input"
        placeholder="Search rooms"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      {error && (
        <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>
      )}

      {grouped.map(([place, list]) => (
        <section key={place} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: "1rem", color: "var(--muted)" }}>{place}</h2>
          <div className="grid3" style={{ marginTop: 8 }}>
            {list.map((r) => {
              const holder = claims[r.id];
              const isMine = holder === teacher;
              return (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <strong>{r.name.replace(/ \(.*\)$/, "")}</strong>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: holder
                          ? isMine
                            ? "var(--ok)"
                            : "var(--danger)"
                          : "var(--muted)",
                      }}
                    >
                      {holder
                        ? isMine
                          ? "You're here"
                          : `Claimed by ${holder}`
                        : "Available"}
                    </div>
                  </div>
                  <button
                    className={isMine ? "btnGhost" : "btn"}
                    disabled={!!holder && !isMine}
                    onClick={() => toggle(r)}
                  >
                    {isMine ? "Leave" : mine.length > 0 ? "Move here" : "Claim"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {grouped.length === 0 && <p className="sub">No rooms match.</p>}
    </>
  );
}

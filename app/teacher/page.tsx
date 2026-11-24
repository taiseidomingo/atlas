"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface Room {
  id: string;
  name: string;
  place: string;
}

interface RoomUsage {
  id: string;
  name: string;
  uses: number;
  currentlyClaimed: boolean;
  uniqueProfessors: number;
}

interface RoomActivity {
  id: string;
  professor: string;
  professorId: string;
  nodeId: string;
  roomName: string;
  floor: string;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  status: "active" | "released" | "complete" | "incomplete";
}

interface DashboardData {
  usage: RoomUsage[];
  totalUses: number;
  totalProfessors: number;
  mostUsed: RoomUsage | null;
  leastUsed: RoomUsage | null;
  frequentlyUsed: RoomUsage[];
  notUsed: RoomUsage[];
  trends: { date: string; uses: number }[];
  recentActivity: RoomActivity[];
  activities: RoomActivity[];
  claimsToday: number;
  claimsThisWeek: number;
  topProfessors: { name: string; claims: number }[];
  occupiedRooms: { nodeId: string; roomName: string; professor: string }[];
  availableRooms: { nodeId: string; roomName: string }[];
}

export default function TeacherPage() {
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [demo, setDemo] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [usage, setUsage] = useState<RoomUsage[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [period, setPeriod] = useState("week");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatus, setActivityStatus] = useState("");
  const [activityFloor, setActivityFloor] = useState("");
  const [activityRoom, setActivityRoom] = useState("");
  const [activityDate, setActivityDate] = useState("");

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

  const loadDashboard = useCallback(async () => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
    }
    if (activitySearch) params.set("search", activitySearch);
    if (activityStatus) params.set("status", activityStatus);
    if (activityFloor) params.set("floor", activityFloor);
    if (activityRoom) params.set("room", activityRoom);
    if (activityDate) params.set("date", activityDate);
    const res = await fetch(`/api/admin/dashboard?${params.toString()}`);
    if (!res.ok) throw new Error("dashboard");
    const data = await res.json();
    setDashboard(data);
    setUsage(data.usage ?? []);
  }, [
    period,
    fromDate,
    toDate,
    activitySearch,
    activityStatus,
    activityFloor,
    activityRoom,
    activityDate,
  ]);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/session");
      if (!res.ok) throw new Error("session");
      const data = await res.json();
      const signedInAdmin =
        data.admin === true ||
        (typeof data.teacher === "string" &&
          data.teacher.trim().toLowerCase() === "admin");
      setTeacher(data.teacher ?? null);
      setAdmin(signedInAdmin);
      setDemo(!!data.demo);
      setRooms(data.rooms ?? []);
      if (data.teacher && !signedInAdmin) await loadClaims();
      if (signedInAdmin) {
        await loadDashboard();
      }
    } catch {
      setError(
        "Couldn't reach the server. Check that npm run dev is running, then refresh.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadClaims, loadDashboard]);

  useEffect(() => {
    const timer = setTimeout(loadSession, 0);
    return () => clearTimeout(timer);
  }, [loadSession]);

  useEffect(() => {
    if (!admin) return;
    const timer = setTimeout(() => {
      loadDashboard().catch(() => {
        setError("Couldn't load the admin dashboard.");
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    admin,
    period,
    fromDate,
    toDate,
    activitySearch,
    activityStatus,
    activityFloor,
    activityRoom,
    activityDate,
    loadDashboard,
  ]);

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
    setAdmin(false);
    setRooms([]);
    setUsage([]);
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

  const rename = async (room: RoomUsage) => {
    setError("");
    const name = (draftNames[room.id] ?? room.name).trim();
    if (!name) return setError("Room name cannot be empty.");
    const res = await fetch("/api/admin/dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: room.id, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Room rename failed.");
    await loadSession();
  };

  const exportReport = () => {
    if (!dashboard) return;
    const rows = [
      [
        "Professor Name",
        "Professor ID",
        "Room Number",
        "Floor",
        "Date",
        "Time Claimed",
        "Time Released",
        "Duration (minutes)",
        "Status",
      ],
      ...dashboard.activities.map((activity) => [
        activity.professor,
        activity.professorId ?? "",
        activity.roomName,
        activity.floor ?? "",
        activity.checkIn.slice(0, 10),
        activity.checkIn,
        activity.checkOut ?? "",
        activity.durationMinutes?.toString() ?? "",
        activity.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-room-activity-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          Sign in to claim the room you&apos;re in, so students can find you.
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

  if (admin) {
    const data = dashboard;
    const roomUsage = data?.usage ?? usage;
    const maxUses = Math.max(1, ...roomUsage.map((room) => room.uses));
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
            <h1 className="pageTitle">Admin Dashboard</h1>
            <p className="sub">Signed in as admin · room usage overview</p>
          </div>
          <button className="btnGhost" onClick={logout}>
            Log out
          </button>
        </div>
          <div
            className="card"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "end",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <label style={{ minWidth: 160 }}>
              <div style={{ fontSize: "0.82rem", marginBottom: 6 }}>Period</div>
              <select
                className="select"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            {period === "custom" && (
              <>
                <label>
                  <div style={{ fontSize: "0.82rem", marginBottom: 6 }}>From</div>
                  <input
                    className="input"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>
                <label>
                  <div style={{ fontSize: "0.82rem", marginBottom: 6 }}>To</div>
                  <input
                    className="input"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
              </>
            )}
            <button className="btn" onClick={exportReport} disabled={!data}>
              Export CSV
            </button>
          </div>
        {error && (
          <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>
        )}
        <div className="grid3">
          <section className="card">
              <div className="sub">Total room usage</div>
              <h2 style={{ margin: "4px 0" }}>{data?.totalUses ?? 0}</h2>
          </section>
          <section className="card">
              <div className="sub">Professors who used rooms</div>
              <h2 style={{ margin: "4px 0" }}>{data?.totalProfessors ?? 0}</h2>
            </section>
            <section className="card">
              <div className="sub">Most frequently used</div>
              <h2 style={{ margin: "4px 0", fontSize: "1.1rem" }}>
                {data?.mostUsed
                  ? `${data.mostUsed.name} (${data.mostUsed.uses})`
                  : "No usage"}
              </h2>
            </section>
            <section className="card">
              <div className="sub">Least frequently used</div>
              <h2 style={{ margin: "4px 0", fontSize: "1.1rem" }}>
                {data?.leastUsed
                  ? `${data.leastUsed.name} (${data.leastUsed.uses})`
                  : "No rooms"}
              </h2>
          </section>
        </div>
        <div className="grid3" style={{ marginTop: 18 }}>
          <section className="card">
            <div className="sub">Claims today</div>
            <h2 style={{ margin: "4px 0" }}>{data?.claimsToday ?? 0}</h2>
          </section>
          <section className="card">
            <div className="sub">Claims this week</div>
            <h2 style={{ margin: "4px 0" }}>{data?.claimsThisWeek ?? 0}</h2>
          </section>
          <section className="card">
            <div className="sub">
              Occupied · Available
            </div>
            <h2 style={{ margin: "4px 0", fontSize: "1.1rem" }}>
              {data?.occupiedRooms.length ?? 0} ·{" "}
              {data?.availableRooms.length ?? 0}
            </h2>
          </section>
          <section className="card">
            <div className="sub">Top professors</div>
            {(data?.topProfessors ?? []).length === 0 ? (
              <p className="sub">No claims recorded.</p>
            ) : (
              (data?.topProfessors ?? []).slice(0, 3).map((professor) => (
                <div key={professor.name} style={{ fontSize: "0.9rem" }}>
                  {professor.name} — {professor.claims}
                </div>
              ))
            )}
          </section>
        </div>
          <section className="card" style={{ marginTop: 22 }}>
            <h2 style={{ marginTop: 0 }}>Room usage comparison</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {roomUsage.map((room) => (
                <div
                  key={room.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, 220px) 1fr 52px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <strong style={{ fontSize: "0.9rem" }}>{room.name}</strong>
                  <div
                    style={{
                      height: 18,
                      borderRadius: 999,
                      background: "var(--brand-soft)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(room.uses / maxUses) * 100}%`,
                        height: "100%",
                        minWidth: room.uses > 0 ? 5 : 0,
                        background: "var(--brand)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span style={{ color: "var(--muted)" }}>{room.uses}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card" style={{ marginTop: 22 }}>
            <h2 style={{ marginTop: 0 }}>Usage trend</h2>
            <div
              style={{
                display: "flex",
                alignItems: "end",
                gap: 5,
                height: 180,
                overflowX: "auto",
                paddingTop: 10,
              }}
            >
              {(data?.trends ?? []).map((day) => {
                const trendMax = Math.max(
                  1,
                  ...(data?.trends ?? []).map((item) => item.uses),
                );
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.uses} uses`}
                    style={{
                      minWidth: 18,
                      height: `${Math.max(4, (day.uses / trendMax) * 150)}px`,
                      background: "var(--brand)",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                );
              })}
            </div>
          </section>
          <section className="card" style={{ marginTop: 22 }}>
            <h2 style={{ marginTop: 0 }}>Recent room activity</h2>
            {(data?.recentActivity ?? []).length === 0 ? (
              <p className="sub">No room activity recorded.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Professor", "Room", "Check-in", "Check-out", "Duration", "Status"].map(
                        (heading) => (
                          <th
                            key={heading}
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid var(--line)",
                              padding: "8px",
                            }}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentActivity ?? []).map((activity) => (
                      <tr key={activity.id}>
                        <td style={{ padding: "8px" }}>{activity.professor}</td>
                        <td style={{ padding: "8px" }}>{activity.roomName}</td>
                        <td style={{ padding: "8px" }}>
                          {new Date(activity.checkIn).toLocaleString()}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {activity.checkOut
                            ? new Date(activity.checkOut).toLocaleString()
                            : "Incomplete"}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {activity.durationMinutes === null
                            ? "-"
                            : `${activity.durationMinutes} min`}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            color:
                              activity.status === "complete"
                                ? "var(--ok)"
                                : "var(--danger)",
                          }}
                        >
                          {activity.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        <section className="card" style={{ marginTop: 22 }}>
          <h2 style={{ marginTop: 0 }}>Room Activity Logs</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <input
              className="input"
              placeholder="Search professor or room"
              value={activitySearch}
              onChange={(event) => setActivitySearch(event.target.value)}
            />
            <input
              className="input"
              placeholder="Room number"
              value={activityRoom}
              onChange={(event) => setActivityRoom(event.target.value)}
            />
            <input
              className="input"
              placeholder="Floor"
              value={activityFloor}
              onChange={(event) => setActivityFloor(event.target.value)}
            />
            <input
              className="input"
              type="date"
              value={activityDate}
              onChange={(event) => setActivityDate(event.target.value)}
            />
            <select
              className="select"
              value={activityStatus}
              onChange={(event) => setActivityStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="incomplete">Incomplete</option>
              <option value="released">Released</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          {(data?.activities ?? []).length === 0 ? (
            <p className="sub">No room claim activity matches the filters.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "Professor Name",
                      "Professor ID",
                      "Room Number",
                      "Floor",
                      "Date",
                      "Time Claimed",
                      "Time Released",
                      "Duration",
                      "Status",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          borderBottom: "1px solid var(--line)",
                          padding: "8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.activities ?? []).map((activity) => (
                    <tr key={activity.id}>
                      <td style={{ padding: "8px" }}>{activity.professor}</td>
                      <td style={{ padding: "8px" }}>
                        {activity.professorId ?? "—"}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {activity.roomName}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {activity.floor ?? "—"}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {new Date(activity.checkIn).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {new Date(activity.checkIn).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {activity.checkOut
                          ? new Date(activity.checkOut).toLocaleTimeString()
                          : activity.status === "active"
                            ? "Currently Active"
                            : "Incomplete"}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {activity.durationMinutes === null
                          ? "-"
                          : `${activity.durationMinutes} min`}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          color:
                            activity.status === "released" ||
                            activity.status === "complete"
                              ? "var(--ok)"
                              : "var(--danger)",
                        }}
                      >
                        {activity.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card" style={{ marginTop: 22 }}>
          <h2 style={{ marginTop: 0 }}>Rename rooms</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {usage.map((room) => (
              <div
                key={room.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <input
                  className="input"
                  value={draftNames[room.id] ?? room.name}
                  onChange={(event) =>
                    setDraftNames((current) => ({
                      ...current,
                      [room.id]: event.target.value,
                    }))
                  }
                  aria-label={`Name for ${room.name}`}
                />
                <button className="btnGhost" onClick={() => rename(room)}>
                  Save
                </button>
              </div>
            ))}
          </div>
        </section>
      </>
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

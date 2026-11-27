"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./Admin.module.css";
import TeacherAccounts from "./TeacherAccounts";
import FacultySchedules from "./FacultySchedules";
import Departments from "./Departments";
import KnowledgeBase from "./KnowledgeBase";
import {
  IconActivity,
  IconBook,
  IconBuilding,
  IconCalendar,
  IconDoor,
  IconDownload,
  IconLogout,
  IconMap,
  IconNodes,
  IconOverview,
  IconPin,
  IconShield,
  IconTag,
  IconUsers,
} from "./icons";

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
  trends: { date: string; uses: number }[];
  recentActivity: RoomActivity[];
  activities: RoomActivity[];
  claimsToday: number;
  claimsThisWeek: number;
  topProfessors: { name: string; claims: number }[];
  occupiedRooms: { nodeId: string; roomName: string; professor: string }[];
  availableRooms: { nodeId: string; roomName: string }[];
}

type Section =
  | "overview"
  | "activity"
  | "map"
  | "teachers"
  | "schedules"
  | "departments"
  | "knowledge";

type NavGroup = "Campus" | "Faculty" | "Chatbot";

const SECTIONS: {
  id: Section;
  group: NavGroup;
  label: string;
  title: string;
  description: string;
  Icon: (p: { size?: number }) => React.ReactElement;
}[] = [
  {
    id: "overview",
    group: "Campus",
    label: "Overview",
    title: "Overview",
    description: "Room usage across campus at a glance.",
    Icon: IconOverview,
  },
  {
    id: "activity",
    group: "Campus",
    label: "Activity logs",
    title: "Room activity logs",
    description: "Every room claim and release, with filters and CSV export.",
    Icon: IconActivity,
  },
  {
    id: "map",
    group: "Campus",
    label: "Map management",
    title: "Map management",
    description: "Maintain location names and walkable path nodes on the campus map.",
    Icon: IconMap,
  },
  {
    id: "teachers",
    group: "Faculty",
    label: "Faculty accounts",
    title: "Faculty accounts",
    description: "Create, edit, activate or deactivate faculty sign-ins.",
    Icon: IconUsers,
  },
  {
    id: "schedules",
    group: "Faculty",
    label: "Faculty schedules",
    title: "Faculty schedules",
    description: "Weekly class, consultation and leave blocks the chatbot uses to help students find professors.",
    Icon: IconCalendar,
  },
  {
    id: "departments",
    group: "Faculty",
    label: "Departments",
    title: "Department assignments",
    description: "Each department's faculty area, and which faculty belong to it.",
    Icon: IconBuilding,
  },
  {
    id: "knowledge",
    group: "Chatbot",
    label: "Knowledge base",
    title: "FAQ & knowledge base",
    description: "Documents the chatbot answers campus questions from. Nothing outside these is used.",
    Icon: IconBook,
  },
];

const NAV_GROUPS: NavGroup[] = ["Campus", "Faculty", "Chatbot"];

const PERIOD_LABEL: Record<string, string> = {
  day: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  custom: "Custom range",
};

function statusPill(status: RoomActivity["status"]): string {
  if (status === "active") return styles.pillWarn;
  if (status === "complete" || status === "released") return styles.pillOk;
  return styles.pillDanger;
}

export default function AdminDashboard({
  adminName,
  onLogout,
}: {
  adminName: string;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [period, setPeriod] = useState("week");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [date, setDate] = useState("");

  // Keep the open section in the URL hash so refresh / back keeps it.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Section;
    if (SECTIONS.some((s) => s.id === fromHash)) {
      const timer = setTimeout(() => setSection(fromHash), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const open = (next: Section) => {
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  const loadDashboard = useCallback(async () => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
    }
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (floor) params.set("floor", floor);
    if (room) params.set("room", room);
    if (date) params.set("date", date);
    const res = await fetch(`/api/admin/dashboard?${params.toString()}`);
    if (!res.ok) throw new Error("dashboard");
    setData(await res.json());
    setError("");
  }, [period, fromDate, toDate, search, status, floor, room, date]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard().catch(() => setError("Couldn't load dashboard data."));
    }, 250);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const exportReport = () => {
    if (!data) return;
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
      ...data.activities.map((a) => [
        a.professor,
        a.professorId ?? "",
        a.roomName,
        a.floor ?? "",
        a.checkIn.slice(0, 10),
        a.checkIn,
        a.checkOut ?? "",
        a.durationMinutes?.toString() ?? "",
        a.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-room-activity-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const current = SECTIONS.find((s) => s.id === section)!;

  const periodControls = (
    <div className={styles.toolbar}>
      <select
        className={styles.select}
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        aria-label="Reporting period"
      >
        <option value="day">Today</option>
        <option value="week">Last 7 days</option>
        <option value="month">Last 30 days</option>
        <option value="custom">Custom range</option>
      </select>
      {period === "custom" && (
        <>
          <input
            className={styles.input}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
          />
          <input
            className={styles.input}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
          />
        </>
      )}
    </div>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Admin navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <IconShield />
          </span>
          <span className={styles.brandText}>
            <strong>ATLAS Admin</strong>
            <span>Control center</span>
          </span>
        </div>
        <nav className={styles.navGroups} aria-label="Admin sections">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <p className={styles.navGroupLabel}>{group}</p>
              <div className={styles.nav}>
                {SECTIONS.filter((s) => s.group === group).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.navItem} ${section === id ? styles.navItemActive : ""}`}
                    aria-current={section === id ? "page" : undefined}
                    onClick={() => open(id)}
                  >
                    <Icon />
                    {label}
                    {id === "teachers" && teacherCount !== null && (
                      <span className={styles.navCount}>{teacherCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span>
            Signed in as <strong>{adminName}</strong>
          </span>
          <button type="button" className={styles.btnGhost} onClick={onLogout}>
            <IconLogout size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{current.title}</h1>
            <p className={styles.subtitle}>{current.description}</p>
          </div>
          {section === "overview" && periodControls}
          {section === "activity" && (
            <div className={styles.toolbar}>
              {periodControls}
              <button
                type="button"
                className={styles.btn}
                onClick={exportReport}
                disabled={!data || data.activities.length === 0}
              >
                <IconDownload size={16} /> Export CSV
              </button>
            </div>
          )}
        </header>

        {error && (section === "overview" || section === "activity") && (
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            {error}
          </div>
        )}

        {section === "overview" && <Overview data={data} period={period} />}

        {section === "activity" && (
          <section className={styles.panel}>
            <div className={styles.filters}>
              <input
                className={styles.input}
                placeholder="Search professor or room"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search activity"
              />
              <input
                className={styles.input}
                placeholder="Room number"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                aria-label="Room"
              />
              <input
                className={styles.input}
                placeholder="Floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                aria-label="Floor"
              />
              <input
                className={styles.input}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
              />
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="incomplete">Incomplete</option>
                <option value="released">Released</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Professor</th>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Date</th>
                    <th>Claimed</th>
                    <th>Released</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.activities ?? []).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className={styles.cellMain}>{a.professor}</span>
                        {a.professorId && (
                          <span className={styles.cellSub}>@{a.professorId}</span>
                        )}
                      </td>
                      <td>{a.roomName}</td>
                      <td>{a.floor || "—"}</td>
                      <td>{new Date(a.checkIn).toLocaleDateString()}</td>
                      <td>{new Date(a.checkIn).toLocaleTimeString()}</td>
                      <td>
                        {a.checkOut
                          ? new Date(a.checkOut).toLocaleTimeString()
                          : a.status === "active"
                            ? "In progress"
                            : "—"}
                      </td>
                      <td>
                        {a.durationMinutes === null ? "—" : `${a.durationMinutes} min`}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${statusPill(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.activities ?? []).length === 0 && (
                <div className={styles.empty}>
                  No room activity matches the filters for{" "}
                  {PERIOD_LABEL[period].toLowerCase()}.
                </div>
              )}
            </div>
          </section>
        )}

        {section === "map" && (
          <>
            <div className={styles.toolCards}>
              <Link href="/navigation?admin=names" className={styles.toolCard}>
                <span className={styles.toolIcon}>
                  <IconTag size={20} />
                </span>
                <h3>Edit location names</h3>
                <p>
                  Rename buildings, floors, rooms and campus areas. Changes appear
                  on the map and in search immediately.
                </p>
                <span className={styles.toolLink}>Open name editor →</span>
              </Link>
              <Link href="/navigation?admin=nodes" className={styles.toolCard}>
                <span className={styles.toolIcon}>
                  <IconNodes size={20} />
                </span>
                <h3>Build map nodes</h3>
                <p>
                  Click on any map or floor plan to capture exact X/Y coordinates
                  for new walkable path nodes.
                </p>
                <span className={styles.toolLink}>Open node builder →</span>
              </Link>
              <Link href="/navigation" className={styles.toolCard}>
                <span className={styles.toolIcon}>
                  <IconPin size={20} />
                </span>
                <h3>Preview campus map</h3>
                <p>
                  Check routes and labels exactly as students see them. Admin
                  tools stay in a toolbar above the map.
                </p>
                <span className={styles.toolLink}>Open campus map →</span>
              </Link>
            </div>
            <div className={`${styles.notice} ${styles.noticeInfo}`}>
              <IconShield size={18} />
              <span>
                Map editing tools are visible only to administrators. Students and
                teachers see the map without any editing or node-management
                controls, and the name-editing API rejects non-admin requests.
              </span>
            </div>
          </>
        )}

        {section === "teachers" && <TeacherAccounts onCountChange={setTeacherCount} />}
        {section === "schedules" && <FacultySchedules />}
        {section === "departments" && <Departments />}
        {section === "knowledge" && <KnowledgeBase />}
      </div>
    </div>
  );
}

function Overview({ data, period }: { data: DashboardData | null; period: string }) {
  const usage = data?.usage ?? [];
  const maxUses = Math.max(1, ...usage.map((r) => r.uses));
  const trends = data?.trends ?? [];
  const trendMax = Math.max(1, ...trends.map((d) => d.uses));

  return (
    <>
      <div className={styles.stats}>
        <Stat icon={<IconActivity size={16} />} label={`Room uses · ${PERIOD_LABEL[period]}`} value={data?.totalUses ?? 0} />
        <Stat icon={<IconCalendar size={16} />} label="Claims today" value={data?.claimsToday ?? 0} />
        <Stat icon={<IconCalendar size={16} />} label="Claims this week" value={data?.claimsThisWeek ?? 0} />
        <Stat
          icon={<IconDoor size={16} />}
          label="Occupied · available"
          value={`${data?.occupiedRooms.length ?? 0} · ${data?.availableRooms.length ?? 0}`}
        />
        <Stat icon={<IconUsers size={16} />} label="Active professors" value={data?.totalProfessors ?? 0} />
        <Stat
          icon={<IconPin size={16} />}
          label="Most used room"
          value={data?.mostUsed ? `${data.mostUsed.name} (${data.mostUsed.uses})` : "No usage yet"}
          small
        />
      </div>

      <div className={styles.grid2}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Usage trend</h2>
              <p className={styles.panelHint}>Room claims per day · {PERIOD_LABEL[period]}</p>
            </div>
          </div>
          <div className={styles.trend} role="img" aria-label="Room claims per day">
            {trends.map((day) => (
              <div
                key={day.date}
                className={styles.trendBar}
                title={`${day.date}: ${day.uses} uses`}
                style={{ height: `${Math.max(3, (day.uses / trendMax) * 150)}px` }}
              />
            ))}
          </div>
          {trends.length > 0 && (
            <div className={styles.trendAxis}>
              <span>{trends[0].date}</span>
              <span>{trends[trends.length - 1].date}</span>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Rooms in use now</h2>
              <p className={styles.panelHint}>Currently claimed by a teacher</p>
            </div>
          </div>
          {(data?.occupiedRooms ?? []).length === 0 ? (
            <div className={styles.empty}>No rooms are claimed right now.</div>
          ) : (
            <ul className={styles.list}>
              {data!.occupiedRooms.map((r) => (
                <li key={r.nodeId} className={styles.listItem}>
                  <strong>{r.roomName}</strong>
                  <span>{r.professor}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.panelTitle} style={{ margin: "18px 0 10px", fontSize: "0.98rem" }}>
            Top professors
          </h3>
          {(data?.topProfessors ?? []).length === 0 ? (
            <div className={styles.empty}>No claims recorded.</div>
          ) : (
            <ul className={styles.list}>
              {data!.topProfessors.map((p) => (
                <li key={p.name} className={styles.listItem}>
                  <span>{p.name}</span>
                  <strong>{p.claims}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Room usage comparison</h2>
            <p className={styles.panelHint}>
              Claims per room · {PERIOD_LABEL[period]}
              {data?.leastUsed ? ` · least used: ${data.leastUsed.name}` : ""}
            </p>
          </div>
        </div>
        {usage.length === 0 ? (
          <div className={styles.empty}>No claimable rooms found.</div>
        ) : (
          <div className={styles.bars}>
            {usage.map((r) => (
              <div key={r.id} className={styles.barRow}>
                <span className={styles.barName} title={r.name}>
                  {r.name}
                </span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(r.uses / maxUses) * 100}%`,
                      minWidth: r.uses > 0 ? 5 : 0,
                    }}
                  />
                </div>
                <span className={styles.barValue}>{r.uses}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>
        <span className={styles.statIcon}>{icon}</span>
        {label}
      </span>
      <span className={small ? styles.statValueSm : styles.statValue}>{value}</span>
    </div>
  );
}

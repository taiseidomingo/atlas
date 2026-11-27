import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEPARTMENTS, isDepartment, type Department } from "./departments";
import { campusGraph } from "./graph";
import { findTeacherById } from "./teacherAccounts";
import { markDirty, useKv } from "./storeMode";

/**
 * Faculty schedules and department faculty areas (admin-managed).
 * Stored in data/faculty.json (git-ignored runtime data).
 */
export const SCHEDULE_STATUSES = ["in-class", "office-hours", "available", "unavailable"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  "in-class": "In class",
  "office-hours": "Office hours",
  available: "Available",
  unavailable: "Unavailable / on leave",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ScheduleEntry {
  id: string;
  /** Linked teacher account, when the professor has one. */
  teacherId: string | null;
  professorName: string;
  department: Department;
  day: number; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM" 24h
  end: string;
  location: string;
  /** Map node for "show route", optional. */
  nodeId: string | null;
  status: ScheduleStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentArea {
  location: string;
  nodeId: string | null;
}

interface FacultyData {
  schedules: ScheduleEntry[];
  areas: Partial<Record<Department, DepartmentArea>>;
}

// Defaults where the department's office is already on the campus map.
const DEFAULT_AREAS: Partial<Record<Department, DepartmentArea>> = {
  "Department of Computer Studies": { location: "Dept. of Computer Studies office, Old Building 2nd floor", nodeId: "OB-2.1-DCS" },
  "Department of Management": { location: "Department of Management office, New Building 1st floor", nodeId: "NB-1-MGMT" },
  "Department of Physical Education": { location: "PE Department office, New Building 1st floor", nodeId: "NB-1-PE" },
  "Teacher Education Department": { location: "Education Department, New Building 2nd floor", nodeId: "NB-2-DEPT" },
  "Department of Languages and Mass Communication": { location: "DLMC office, New Building 4th floor", nodeId: "NB-4-DEPT" },
  "Department of Social Sciences and Humanities": { location: "Social Department office, New Building 5th floor", nodeId: "NB-5-DEPT" },
};

const dataFile = path.join(process.cwd(), "data", "faculty.json");
const store = globalThis as unknown as { atlasFaculty?: FacultyData };

function load(): FacultyData {
  if (store.atlasFaculty) return store.atlasFaculty;
  let data: FacultyData = { schedules: [], areas: { ...DEFAULT_AREAS } };
  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    data = {
      schedules: Array.isArray(saved.schedules) ? saved.schedules : [],
      areas: saved.areas && typeof saved.areas === "object" ? saved.areas : { ...DEFAULT_AREAS },
    };
  } catch {
    // first run: defaults
  }
  store.atlasFaculty = data;
  return data;
}

function save(data: FacultyData) {
  store.atlasFaculty = data;
  if (useKv) {
    markDirty("faculty"); // saved to Redis at the end of the request (lib/persist.ts)
    return;
  }
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, dataFile);
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const nodeExists = (id: unknown) => typeof id === "string" && campusGraph.nodes.some((n) => n.id === id);

/** Snapshot for the shared store (lib/persist.ts). */
export function exportFaculty(): FacultyData {
  return load();
}

/** Replace in-memory schedules and areas with the shared store's copy. */
export function importFaculty(saved: Partial<FacultyData> | null): void {
  store.atlasFaculty = {
    schedules: Array.isArray(saved?.schedules) ? saved.schedules : [],
    areas: saved?.areas && typeof saved.areas === "object" ? saved.areas : { ...DEFAULT_AREAS },
  };
}

// ---------------------------------------------------------------- schedules

export function listSchedules(): ScheduleEntry[] {
  return [...load().schedules].sort(
    (a, b) =>
      a.professorName.localeCompare(b.professorName) || a.day - b.day || a.start.localeCompare(b.start),
  );
}

function parseSchedule(input: Record<string, unknown>, base?: ScheduleEntry): Result<Omit<ScheduleEntry, "id" | "createdAt" | "updatedAt">> {
  const v = { ...base, ...input } as Record<string, unknown>;
  let teacherId: string | null = typeof v.teacherId === "string" && v.teacherId ? v.teacherId : null;
  let professorName = typeof v.professorName === "string" ? v.professorName.trim() : "";
  let department = v.department;
  if (teacherId) {
    const account = findTeacherById(teacherId);
    if (!account) return { ok: false, error: "The selected teacher account no longer exists." };
    professorName = account.displayName;
    if (!isDepartment(department) && isDepartment(account.department)) department = account.department;
  } else {
    teacherId = null;
  }
  if (!professorName || professorName.length > 80) return { ok: false, error: "Professor name is required (up to 80 characters)." };
  if (!isDepartment(department)) return { ok: false, error: "Select a department." };
  const day = Number(v.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: "Select a day of the week." };
  if (typeof v.start !== "string" || typeof v.end !== "string" || !TIME_RE.test(v.start) || !TIME_RE.test(v.end))
    return { ok: false, error: "Enter start and end times." };
  if (v.start >= v.end) return { ok: false, error: "End time must be after start time." };
  const location = typeof v.location === "string" ? v.location.trim() : "";
  if (!location || location.length > 120) return { ok: false, error: "Location is required (up to 120 characters)." };
  const nodeId = v.nodeId ? (nodeExists(v.nodeId) ? (v.nodeId as string) : undefined) : null;
  if (nodeId === undefined) return { ok: false, error: "Unknown map location." };
  if (!(SCHEDULE_STATUSES as readonly unknown[]).includes(v.status)) return { ok: false, error: "Select an availability status." };
  const note = typeof v.note === "string" ? v.note.trim().slice(0, 200) : "";
  return {
    ok: true,
    value: { teacherId, professorName, department, day, start: v.start, end: v.end, location, nodeId, status: v.status as ScheduleStatus, note },
  };
}

function overlaps(entry: Omit<ScheduleEntry, "id" | "createdAt" | "updatedAt">, exceptId?: string): ScheduleEntry | undefined {
  const key = professorKey(entry.professorName);
  return load().schedules.find(
    (s) =>
      s.id !== exceptId &&
      professorKey(s.professorName) === key &&
      s.day === entry.day &&
      s.start < entry.end &&
      entry.start < s.end,
  );
}

export function createSchedule(input: Record<string, unknown>): Result<ScheduleEntry> {
  const parsed = parseSchedule(input);
  if (!parsed.ok) return parsed;
  const clash = overlaps(parsed.value);
  if (clash) return { ok: false, error: `Overlaps an existing ${DAY_NAMES[clash.day]} block (${clash.start}–${clash.end}).` };
  const now = new Date().toISOString();
  const entry: ScheduleEntry = { id: randomUUID(), ...parsed.value, createdAt: now, updatedAt: now };
  const data = load();
  save({ ...data, schedules: [...data.schedules, entry] });
  return { ok: true, value: entry };
}

export function updateSchedule(id: string, input: Record<string, unknown>): Result<ScheduleEntry> {
  const data = load();
  const current = data.schedules.find((s) => s.id === id);
  if (!current) return { ok: false, error: "Schedule not found." };
  const parsed = parseSchedule(input, current);
  if (!parsed.ok) return parsed;
  const clash = overlaps(parsed.value, id);
  if (clash) return { ok: false, error: `Overlaps an existing ${DAY_NAMES[clash.day]} block (${clash.start}–${clash.end}).` };
  const entry: ScheduleEntry = { ...current, ...parsed.value, updatedAt: new Date().toISOString() };
  save({ ...data, schedules: data.schedules.map((s) => (s.id === id ? entry : s)) });
  return { ok: true, value: entry };
}

export function deleteSchedule(id: string): boolean {
  const data = load();
  if (!data.schedules.some((s) => s.id === id)) return false;
  save({ ...data, schedules: data.schedules.filter((s) => s.id !== id) });
  return true;
}

/** Keep schedule names / departments in step with a renamed or reassigned account. */
export function syncTeacherSchedules(teacherId: string, displayName: string, department: string) {
  const data = load();
  if (!data.schedules.some((s) => s.teacherId === teacherId)) return;
  save({
    ...data,
    schedules: data.schedules.map((s) =>
      s.teacherId === teacherId
        ? { ...s, professorName: displayName, department: isDepartment(department) ? department : s.department }
        : s,
    ),
  });
}

/** A deleted account's schedules keep the professor's name but lose the link. */
export function unlinkTeacherSchedules(teacherId: string) {
  const data = load();
  if (!data.schedules.some((s) => s.teacherId === teacherId)) return;
  save({
    ...data,
    schedules: data.schedules.map((s) => (s.teacherId === teacherId ? { ...s, teacherId: null } : s)),
  });
}

// ------------------------------------------------------------ dept. areas

export function listDepartmentAreas(): { department: Department; area: DepartmentArea | null }[] {
  const areas = load().areas;
  return DEPARTMENTS.map((department) => ({ department, area: areas[department] ?? null }));
}

export function getDepartmentArea(department: string): DepartmentArea | null {
  return isDepartment(department) ? load().areas[department] ?? null : null;
}

export function setDepartmentArea(department: unknown, area: { location?: unknown; nodeId?: unknown } | null): Result<DepartmentArea | null> {
  if (!isDepartment(department)) return { ok: false, error: "Unknown department." };
  const data = load();
  const areas = { ...data.areas };
  if (!area || (typeof area.location === "string" && !area.location.trim() && !area.nodeId)) {
    delete areas[department];
    save({ ...data, areas });
    return { ok: true, value: null };
  }
  const location = typeof area.location === "string" ? area.location.trim() : "";
  if (!location || location.length > 120) return { ok: false, error: "Describe the faculty area (up to 120 characters)." };
  if (area.nodeId && !nodeExists(area.nodeId)) return { ok: false, error: "Unknown map location." };
  const value: DepartmentArea = { location, nodeId: (area.nodeId as string) || null };
  areas[department] = value;
  save({ ...data, areas });
  return { ok: true, value };
}

// ------------------------------------------------------------ time helpers

export function professorKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|professor|mr|mrs|ms|miss|sir|maam|ma'am|engr|atty)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Current day/time on campus (defaults to Philippine time). */
export function campusNow(date = new Date()): { day: number; time: string } {
  const tz = process.env.CAMPUS_TIMEZONE || "Asia/Manila";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, time: `${get("hour")}:${get("minute")}` };
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

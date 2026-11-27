"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Admin.module.css";
import { IconClose, IconPlus } from "./icons";
import { DEPARTMENTS } from "@/lib/departments";

interface Schedule {
  id: string;
  teacherId: string | null;
  professorName: string;
  department: string;
  day: number;
  start: string;
  end: string;
  location: string;
  nodeId: string | null;
  status: Status;
  note: string;
}

type Status = "in-class" | "office-hours" | "available" | "unavailable";

interface Teacher {
  id: string;
  displayName: string;
  department: string;
  active: boolean;
}

interface LocationGroup {
  group: string;
  options: { id: string; name: string }[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const STATUS: Record<Status, { label: string; pill: string }> = {
  "in-class": { label: "In class", pill: styles.pillWarn },
  "office-hours": { label: "Office hours", pill: styles.pillOk },
  available: { label: "Available", pill: styles.pillOk },
  unavailable: { label: "Unavailable / on leave", pill: styles.pillDanger },
};

type Form = Omit<Schedule, "id"> & { mode: "account" | "other" };

const EMPTY: Form = {
  mode: "account",
  teacherId: null,
  professorName: "",
  department: "",
  day: 1,
  start: "08:00",
  end: "10:00",
  location: "",
  nodeId: null,
  status: "in-class",
  note: "",
};

function fmt(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function FacultySchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [locations, setLocations] = useState<LocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [day, setDay] = useState("");
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/schedules", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSchedules(data.schedules ?? []);
      setTeachers(data.teachers ?? []);
      setLocations(data.locations ?? []);
    } catch {
      setNotice({ kind: "error", text: "Couldn't load faculty schedules." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setEditing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, busy]);

  const now = new Date();
  const nowDay = now.getDay();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules
      .filter(
        (s) =>
          (!department || s.department === department) &&
          (day === "" || s.day === Number(day)) &&
          (!q || `${s.professorName} ${s.location} ${s.note}`.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          a.professorName.localeCompare(b.professorName) ||
          DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
          a.start.localeCompare(b.start),
      );
  }, [schedules, search, department, day]);

  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    filtered.forEach((s) => map.set(s.professorName, [...(map.get(s.professorName) ?? []), s]));
    return [...map.entries()];
  }, [filtered]);

  const professorsCount = new Set(schedules.map((s) => s.professorName)).size;
  const activeNow = schedules.filter((s) => s.day === nowDay && s.start <= nowTime && nowTime < s.end).length;

  const openCreate = (preset?: Partial<Form>) => {
    setForm({ ...EMPTY, mode: teachers.length ? "account" : "other", ...preset });
    setFormError("");
    setEditing("new");
  };

  const openEdit = (s: Schedule) => {
    setForm({ ...s, mode: s.teacherId ? "account" : "other" });
    setFormError("");
    setEditing(s);
  };

  const pickTeacher = (id: string) => {
    const t = teachers.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      teacherId: id || null,
      professorName: t?.displayName ?? "",
      department: t?.department || f.department,
    }));
  };

  const pickLocation = (nodeId: string) => {
    const name = locations.flatMap((g) => g.options).find((o) => o.id === nodeId)?.name;
    setForm((f) => ({ ...f, nodeId: nodeId || null, location: name ?? f.location }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError("");
    const { mode, ...body } = form;
    if (mode === "other") body.teacherId = null;
    try {
      const res = await fetch(editing === "new" ? "/api/admin/schedules" : `/api/admin/schedules/${editing.id}`, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Couldn't save this schedule.");
        return;
      }
      setNotice({
        kind: "ok",
        text: `${editing === "new" ? "Added" : "Updated"} ${DAYS[data.schedule.day]} ${fmt(data.schedule.start)}–${fmt(
          data.schedule.end,
        )} for ${data.schedule.professorName}.`,
      });
      setEditing(null);
      await load();
    } catch {
      setFormError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Schedule) => {
    if (!window.confirm(`Delete ${s.professorName}'s ${DAYS[s.day]} ${fmt(s.start)}–${fmt(s.end)} block?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/schedules/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice({ kind: "ok", text: "Schedule block deleted." });
      await load();
    } catch {
      setNotice({ kind: "error", text: "Couldn't delete this schedule block." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Schedule blocks</span>
          <span className={styles.statValue}>{schedules.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Professors scheduled</span>
          <span className={styles.statValue}>{professorsCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Happening now</span>
          <span className={styles.statValue}>{activeNow}</span>
        </div>
      </div>

      {notice && (
        <div
          className={`${styles.notice} ${notice.kind === "ok" ? styles.noticeOk : styles.noticeError}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button type="button" className={styles.iconBtn} onClick={() => setNotice(null)} aria-label="Dismiss">
            <IconClose size={16} />
          </button>
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Weekly schedules</h2>
            <p className={styles.panelHint}>
              The chatbot uses these when a professor has no active room claim, and labels them as scheduled, not confirmed.
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={() => openCreate()}>
            <IconPlus size={16} /> Add schedule
          </button>
        </div>

        <div className={styles.filters}>
          <input
            className={styles.input}
            placeholder="Search professor, location or note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search schedules"
          />
          <select className={styles.select} value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select className={styles.select} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
            <option value="">All days</option>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Location</th>
                <th>Status</th>
                <th>Note</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            {grouped.map(([name, rows]) => (
              <tbody key={name}>
                <tr className={styles.groupRow}>
                  <td colSpan={6}>
                    <div className={styles.groupHead}>
                      <span>
                        <span className={styles.cellMain}>{name}</span>
                        <span className={styles.cellSub}>
                          {rows[0].department}
                          {!rows[0].teacherId && " · no linked account"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.btnSm}
                        onClick={() =>
                          openCreate({
                            mode: rows[0].teacherId ? "account" : "other",
                            teacherId: rows[0].teacherId,
                            professorName: name,
                            department: rows[0].department,
                          })
                        }
                      >
                        <IconPlus size={14} /> Add block
                      </button>
                    </div>
                  </td>
                </tr>
                {rows.map((s) => {
                  const live = s.day === nowDay && s.start <= nowTime && nowTime < s.end;
                  return (
                    <tr key={s.id}>
                      <td>
                        {DAYS[s.day]}
                        {live && <span className={`${styles.pill} ${styles.pillInfo}`} style={{ marginLeft: 8 }}>Now</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {fmt(s.start)} – {fmt(s.end)}
                      </td>
                      <td>
                        {s.location}
                        {s.nodeId && <span className={styles.cellSub}>On campus map</span>}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${STATUS[s.status].pill}`}>{STATUS[s.status].label}</span>
                      </td>
                      <td>{s.note || "—"}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.btnSm} onClick={() => openEdit(s)} disabled={busy}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnSm} ${styles.btnDanger}`}
                            onClick={() => remove(s)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
          {!loading && grouped.length === 0 && (
            <div className={styles.empty}>
              {schedules.length === 0 ? "No schedules yet. Add a professor's first schedule block." : "No schedules match the filters."}
            </div>
          )}
          {loading && <div className={styles.empty}>Loading schedules…</div>}
        </div>
      </section>

      {editing && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !busy && setEditing(null)}>
          <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sched-title" onSubmit={submit}>
            <div className={styles.dialogHead}>
              <div>
                <h2 id="sched-title" className={styles.panelTitle}>
                  {editing === "new" ? "Add schedule block" : "Edit schedule block"}
                </h2>
                <p className={styles.panelHint}>One block per class, consultation hour or time away.</p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setEditing(null)} aria-label="Close">
                <IconClose />
              </button>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.segmented} role="radiogroup" aria-label="Professor source">
                {(["account", "other"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === m}
                    className={form.mode === m ? styles.segmentOn : ""}
                    onClick={() => setForm({ ...form, mode: m, teacherId: m === "other" ? null : form.teacherId })}
                  >
                    {m === "account" ? "Faculty account" : "Other professor"}
                  </button>
                ))}
              </div>
              {form.mode === "account" ? (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Professor</span>
                  <select className={styles.select} value={form.teacherId ?? ""} onChange={(e) => pickTeacher(e.target.value)} required>
                    <option value="" disabled>
                      Select a faculty account
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.displayName}
                        {t.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                  {teachers.length === 0 && (
                    <span className={styles.fieldHelp}>No faculty accounts yet — create one under Faculty accounts.</span>
                  )}
                </label>
              ) : (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Professor name</span>
                  <input
                    className={styles.input}
                    value={form.professorName}
                    onChange={(e) => setForm({ ...form, professorName: e.target.value })}
                    placeholder="e.g. Prof. Juan Dela Cruz"
                    maxLength={80}
                    required
                  />
                </label>
              )}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Department</span>
                <select
                  className={styles.select}
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Select a department
                  </option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.formRow3}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Day</span>
                  <select className={styles.select} value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}>
                    {DAY_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DAYS[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Start</span>
                  <input className={styles.input} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>End</span>
                  <input className={styles.input} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required />
                </label>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Map location (optional)</span>
                <select className={styles.select} value={form.nodeId ?? ""} onChange={(e) => pickLocation(e.target.value)}>
                  <option value="">Not on the map</option>
                  {locations.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className={styles.fieldHelp}>Lets the chatbot offer a route to this place.</span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Location shown to students</span>
                <input
                  className={styles.input}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. CL 3, or Computer Studies faculty room"
                  maxLength={120}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Availability status</span>
                <select className={styles.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                  {(Object.keys(STATUS) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Note (optional)</span>
                <input
                  className={styles.input}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. BSIT 2-A, consultations by appointment"
                  maxLength={200}
                />
              </label>
              {formError && (
                <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                  {formError}
                </div>
              )}
            </div>
            <div className={styles.dialogFoot}>
              <button type="button" className={styles.btnGhost} onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className={styles.btn} disabled={busy}>
                {busy ? "Saving…" : editing === "new" ? "Add block" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

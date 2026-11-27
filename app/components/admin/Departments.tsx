"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./Admin.module.css";
import { IconClose } from "./icons";
import { DEPARTMENTS } from "@/lib/departments";

interface Member {
  id: string;
  displayName: string;
  active: boolean;
}

interface DepartmentRow {
  department: string;
  area: { location: string; nodeId: string | null } | null;
  teachers: Member[];
}

interface LocationGroup {
  group: string;
  options: { id: string; name: string }[];
}

type Draft = { location: string; nodeId: string };

export default function Departments() {
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [unassigned, setUnassigned] = useState<Member[]>([]);
  const [locations, setLocations] = useState<LocationGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/departments", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.areas ?? []);
      setUnassigned(data.unassigned ?? []);
      setLocations(data.locations ?? []);
      setDrafts(
        Object.fromEntries(
          (data.areas as DepartmentRow[]).map((r) => [
            r.department,
            { location: r.area?.location ?? "", nodeId: r.area?.nodeId ?? "" },
          ]),
        ),
      );
    } catch {
      setNotice({ kind: "error", text: "Couldn't load departments." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const placeName = (id: string) => locations.flatMap((g) => g.options).find((o) => o.id === id)?.name;

  const saveArea = (department: string) => saveAreaValue(department, drafts[department]);

  const saveAreaValue = async (department: string, draft: Draft) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, location: draft.location, nodeId: draft.nodeId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setNotice({
        kind: "ok",
        text: data.area ? `Saved the faculty area for ${department}.` : `Cleared the faculty area for ${department}.`,
      });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reassign = async (member: Member, department: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/teachers/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't reassign.");
      setNotice({ kind: "ok", text: `${member.displayName} now belongs to the ${department}.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const missing = rows.filter((r) => !r.area).length;

  return (
    <>
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

      {!loading && missing > 0 && (
        <div className={`${styles.notice} ${styles.noticeInfo}`}>
          {missing} department{missing > 1 ? "s have" : " has"} no faculty area yet. When a professor from
          {missing > 1 ? " these departments" : " that department"} has no room claim or schedule, the chatbot can only
          say the area isn&apos;t set.
        </div>
      )}

      {unassigned.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Faculty without a department</h2>
          <p className={styles.panelHint}>Assign a department so the chatbot can suggest where to find them.</p>
          <ul className={styles.list} style={{ marginTop: 12 }}>
            {unassigned.map((m) => (
              <li key={m.id} className={styles.listItem} style={{ alignItems: "center" }}>
                <span>{m.displayName}</span>
                <select
                  className={styles.select}
                  value=""
                  onChange={(e) => e.target.value && reassign(m, e.target.value)}
                  disabled={busy}
                  aria-label={`Department for ${m.displayName}`}
                >
                  <option value="">Assign department…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.deptGrid}>
        {rows.map((row) => {
          const draft = drafts[row.department] ?? { location: "", nodeId: "" };
          const dirty =
            draft.location !== (row.area?.location ?? "") || draft.nodeId !== (row.area?.nodeId ?? "");
          return (
            <section key={row.department} className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2 className={styles.panelTitle}>{row.department}</h2>
                  <p className={styles.panelHint}>
                    {row.teachers.length} faculty account{row.teachers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={`${styles.pill} ${row.area ? styles.pillOk : styles.pillWarn}`}>
                  {row.area ? "Area set" : "No area"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Faculty area on the map</span>
                  <select
                    className={styles.select}
                    value={draft.nodeId}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [row.department]: {
                          nodeId: e.target.value,
                          location: draft.location || placeName(e.target.value) || "",
                        },
                      })
                    }
                  >
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
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Description shown to students</span>
                  <input
                    className={styles.input}
                    value={draft.location}
                    onChange={(e) => setDrafts({ ...drafts, [row.department]: { ...draft, location: e.target.value } })}
                    placeholder="e.g. Faculty room, Old Building 2nd floor"
                    maxLength={120}
                  />
                </label>
                <div className={styles.toolbar}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => saveArea(row.department)}
                    disabled={busy || !dirty || (!draft.location.trim() && !!draft.nodeId)}
                  >
                    Save area
                  </button>
                  {row.area && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Clear the faculty area for ${row.department}?`)) return;
                        setDrafts({ ...drafts, [row.department]: { location: "", nodeId: "" } });
                        saveAreaValue(row.department, { location: "", nodeId: "" });
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <h3 className={styles.subheading}>Faculty</h3>
              {row.teachers.length === 0 ? (
                <p className={styles.panelHint}>No faculty accounts assigned.</p>
              ) : (
                <ul className={styles.list}>
                  {row.teachers.map((m) => (
                    <li key={m.id} className={styles.listItem} style={{ alignItems: "center" }}>
                      <span>
                        {m.displayName}
                        {!m.active && <span className={styles.cellSub}>Inactive</span>}
                      </span>
                      <select
                        className={styles.select}
                        value={row.department}
                        onChange={(e) => reassign(m, e.target.value)}
                        disabled={busy}
                        aria-label={`Department for ${m.displayName}`}
                        style={{ maxWidth: 200 }}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {loading && <div className={styles.empty}>Loading departments…</div>}
    </>
  );
}

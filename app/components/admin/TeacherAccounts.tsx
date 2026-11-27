"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Admin.module.css";
import { IconClose, IconPlus } from "./icons";
import { DEPARTMENTS } from "@/lib/departments";

export interface TeacherAccountRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  department: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

type FormState = {
  username: string;
  displayName: string;
  email: string;
  department: string;
  password: string;
};

const EMPTY_FORM: FormState = {
  username: "",
  displayName: "",
  email: "",
  department: "",
  password: "",
};

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TeacherAccounts({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [accounts, setAccounts] = useState<TeacherAccountRow[]>([]);
  const [configured, setConfigured] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [notice, setNotice] = useState<
    { kind: "ok" | "error"; text: string; secret?: string } | null
  >(null);
  const [editing, setEditing] = useState<TeacherAccountRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "load");
      setAccounts(data.accounts ?? []);
      setConfigured(data.configured ?? []);
      onCountChange?.((data.accounts ?? []).length);
    } catch {
      setNotice({ kind: "error", text: "Couldn't load teacher accounts." });
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, busy]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        (statusFilter === "all" || (statusFilter === "active") === a.active) &&
        (!departmentFilter || a.department === departmentFilter) &&
        (!q ||
          [a.displayName, a.username, a.email, a.department].some((v) =>
            v.toLowerCase().includes(q),
          )),
    );
  }, [accounts, search, statusFilter, departmentFilter]);

  const activeCount = accounts.filter((a) => a.active).length;

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, password: generatePassword() });
    setFormError("");
    setEditing("new");
  };

  const openEdit = (account: TeacherAccountRow) => {
    setForm({
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      department: account.department,
      password: "",
    });
    setFormError("");
    setEditing(account);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setFormError("");
    const creating = editing === "new";
    const body: Record<string, string> = {
      displayName: form.displayName,
      email: form.email,
      department: form.department,
    };
    if (!(DEPARTMENTS as readonly string[]).includes(form.department)) {
      setFormError("Select a department.");
      setBusy(false);
      return;
    }
    if (creating) {
      body.username = form.username;
      body.password = form.password;
    } else if (form.password) {
      body.password = form.password;
    }
    try {
      const res = await fetch(
        creating ? "/api/admin/teachers" : `/api/admin/teachers/${editing.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Couldn't save this account.");
        return;
      }
      setEditing(null);
      setNotice(
        creating
          ? {
              kind: "ok",
              text: `Account created for ${data.account.displayName}. Share these sign-in details with them privately:`,
              secret: `${data.account.username} / ${form.password}`,
            }
          : {
              kind: "ok",
              text: form.password
                ? `Saved ${data.account.displayName}. The new password is active and older sign-ins were signed out.`
                : `Saved ${data.account.displayName}.`,
            },
      );
      await load();
    } catch {
      setFormError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (account: TeacherAccountRow, body: object) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/teachers/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      return data;
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (account: TeacherAccountRow) => {
    if (
      account.active &&
      !window.confirm(
        `Deactivate ${account.displayName}? They will be signed out, any room they hold will be released, and they won't be able to sign in until reactivated.`,
      )
    )
      return;
    try {
      await patch(account, { active: !account.active });
      setNotice({
        kind: "ok",
        text: `${account.displayName} is now ${account.active ? "inactive" : "active"}.`,
      });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const resetPassword = async (account: TeacherAccountRow) => {
    if (
      !window.confirm(
        `Reset the password for ${account.displayName}? Their current password stops working and they will be signed out.`,
      )
    )
      return;
    try {
      const data = await patch(account, { resetPassword: true });
      setNotice({
        kind: "ok",
        text: `Temporary password for ${account.displayName} (${account.username}). It is shown only once — share it privately:`,
        secret: data.temporaryPassword,
      });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  };

  const remove = async (account: TeacherAccountRow) => {
    if (
      !window.confirm(
        `Permanently delete the account for ${account.displayName}? This cannot be undone. Past room activity logs are kept. To only block sign-in, deactivate instead.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/teachers/${account.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete this account.");
      setNotice({ kind: "ok", text: `Deleted the account for ${account.displayName}.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const creating = editing === "new";

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Teacher accounts</span>
          <span className={styles.statValue}>{accounts.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Active</span>
          <span className={styles.statValue}>{activeCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Inactive</span>
          <span className={styles.statValue}>{accounts.length - activeCount}</span>
        </div>
      </div>

      {notice && (
        <div
          className={`${styles.notice} ${
            notice.kind === "ok" ? styles.noticeOk : styles.noticeError
          }`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <div style={{ flex: 1 }}>
            {notice.text}
            {notice.secret && (
              <div>
                <code className={styles.secret}>{notice.secret}</code>
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <IconClose size={16} />
          </button>
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Registered teachers</h2>
            <p className={styles.panelHint}>
              Teachers sign in at the Teacher Portal to claim the room they are in.
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <IconPlus size={16} /> Add teacher
          </button>
        </div>

        <div className={styles.filters}>
          <input
            className={styles.input}
            placeholder="Search name, username, email or department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search teacher accounts"
          />
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={styles.select}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Department</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => (
                <tr key={account.id}>
                  <td>
                    <span className={styles.cellMain}>{account.displayName}</span>
                    <span className={styles.cellSub}>@{account.username}</span>
                  </td>
                  <td>{account.department || "—"}</td>
                  <td>{account.email || "—"}</td>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        account.active ? styles.pillOk : styles.pillMuted
                      }`}
                    >
                      {account.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(account.lastLoginAt)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnSm}
                        onClick={() => openEdit(account)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.btnSm}
                        onClick={() => resetPassword(account)}
                        disabled={busy}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className={styles.btnSm}
                        onClick={() => toggleActive(account)}
                        disabled={busy}
                      >
                        {account.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className={`${styles.btnSm} ${styles.btnDanger}`}
                        onClick={() => remove(account)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visible.length === 0 && (
            <div className={styles.empty}>
              {accounts.length === 0
                ? "No teacher accounts yet. Add the first one to get started."
                : "No accounts match the current filters."}
            </div>
          )}
          {loading && <div className={styles.empty}>Loading accounts…</div>}
        </div>

        {configured.length > 0 && (
          <p className={styles.panelHint} style={{ marginTop: 12 }}>
            Also able to sign in (configured on the server, not editable here):{" "}
            {configured.join(", ")}.
          </p>
        )}
      </section>

      {editing && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
        >
          <form
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-dialog-title"
            onSubmit={submit}
          >
            <div className={styles.dialogHead}>
              <div>
                <h2 id="teacher-dialog-title" className={styles.panelTitle}>
                  {creating ? "Add teacher account" : "Edit teacher account"}
                </h2>
                <p className={styles.panelHint}>
                  {creating
                    ? "The teacher signs in with the username and password below."
                    : `Username: @${(editing as TeacherAccountRow).username}`}
                </p>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setEditing(null)}
                aria-label="Close"
                disabled={busy}
              >
                <IconClose />
              </button>
            </div>
            <div className={styles.dialogBody}>
              {creating && (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Username</span>
                  <input
                    className={styles.input}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    autoComplete="off"
                    required
                    minLength={3}
                    maxLength={40}
                    autoFocus
                  />
                  <span className={styles.fieldHelp}>
                    Used to sign in. 3–40 characters; it can’t be changed later.
                  </span>
                </label>
              )}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Display name</span>
                <input
                  className={styles.input}
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Prof. Maria Santos"
                  required
                  maxLength={80}
                  autoFocus={!creating}
                />
                <span className={styles.fieldHelp}>Shown to students on claimed rooms.</span>
              </label>
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
                  {/* Keep a legacy free-text value visible until it is changed. */}
                  {form.department &&
                    !(DEPARTMENTS as readonly string[]).includes(form.department) && (
                      <option value={form.department} disabled>
                        {form.department} (no longer available)
                      </option>
                    )}
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={120}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  {creating ? "Password" : "New password (optional)"}
                </span>
                <div className={styles.inputRow}>
                  <input
                    className={styles.input}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    required={creating}
                    minLength={6}
                    maxLength={128}
                    placeholder={creating ? "" : "Leave blank to keep the current password"}
                  />
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                  >
                    Generate
                  </button>
                </div>
                <span className={styles.fieldHelp}>
                  At least 6 characters. Stored only as a secure hash.
                </span>
              </label>
              {formError && (
                <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
                  {formError}
                </div>
              )}
            </div>
            <div className={styles.dialogFoot}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className={styles.btn} disabled={busy}>
                {busy ? "Saving…" : creating ? "Create account" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

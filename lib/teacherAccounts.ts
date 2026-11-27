import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { isDepartment } from "./departments";
import { markDirty, useKv } from "./storeMode";

/**
 * Teacher accounts managed from the Admin Dashboard.
 *
 * Stored in data/teachers.json (git-ignored runtime data). Passwords are
 * never stored in plain text: each one is hashed with scrypt and a random
 * per-account salt. `sessionVersion` is bumped on deactivation and password
 * resets so existing login cookies for that account stop working.
 */
export interface TeacherAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  department: string;
  passwordHash: string;
  active: boolean;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type PublicTeacherAccount = Omit<TeacherAccount, "passwordHash">;

export interface TeacherInput {
  username?: unknown;
  displayName?: unknown;
  email?: unknown;
  department?: unknown;
  password?: unknown;
  active?: unknown;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const dataFile = path.join(process.cwd(), "data", "teachers.json");
const store = globalThis as unknown as { atlasTeachers?: TeacherAccount[] };

function load(): TeacherAccount[] {
  if (store.atlasTeachers) return store.atlasTeachers;
  let accounts: TeacherAccount[] = [];
  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (Array.isArray(saved.accounts)) accounts = saved.accounts;
  } catch {
    // Created on the first account save.
  }
  store.atlasTeachers = accounts;
  return accounts;
}

function save(accounts: TeacherAccount[]): void {
  store.atlasTeachers = accounts;
  if (useKv) {
    markDirty("teachers"); // saved to Redis at the end of the request (lib/persist.ts)
    return;
  }
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ accounts }, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tmp, dataFile);
}

/** Snapshot for the shared store (lib/persist.ts). Includes password hashes. */
export function exportTeacherAccounts(): TeacherAccount[] {
  return load();
}

/** Replace in-memory accounts with the shared store's copy. */
export function importTeacherAccounts(accounts: unknown): void {
  store.atlasTeachers = Array.isArray(accounts) ? (accounts as TeacherAccount[]) : [];
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function toPublic(account: TeacherAccount): PublicTeacherAccount {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = account;
  return rest;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const USERNAME_RE = /^[a-z0-9][a-z0-9 ._-]{2,39}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "A password is required.";
  if (password.length < 6) return "Passwords must be at least 6 characters.";
  if (password.length > 128) return "Passwords must be 128 characters or fewer.";
  return null;
}

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > max ? null : trimmed;
}

/** Room claims are recorded by display name, so display names must be unique. */
function displayNameTaken(
  displayName: string,
  reserved: Set<string>,
  exceptId?: string,
): boolean {
  const key = normalizeUsername(displayName);
  return (
    reserved.has(key) ||
    load().some(
      (account) => account.id !== exceptId && normalizeUsername(account.displayName) === key,
    )
  );
}

export function listTeacherAccounts(): PublicTeacherAccount[] {
  return load()
    .map(toPublic)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function findTeacherByUsername(username: string): TeacherAccount | null {
  const key = normalizeUsername(username);
  return load().find((account) => account.username === key) ?? null;
}

export function findTeacherById(id: string): TeacherAccount | null {
  return load().find((account) => account.id === id) ?? null;
}

/**
 * @param reserved usernames that may not be used (the admin login and any
 *   accounts configured through environment variables).
 */
export function createTeacherAccount(
  input: TeacherInput,
  reserved: Set<string>,
): Result<PublicTeacherAccount> {
  if (typeof input.username !== "string")
    return { ok: false, error: "A username is required." };
  const username = normalizeUsername(input.username);
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "Usernames must be 3–40 characters: letters, numbers, spaces, dots, dashes or underscores.",
    };
  }
  if (reserved.has(username) || findTeacherByUsername(username)) {
    return { ok: false, error: "That username is already in use." };
  }
  const displayName = text(input.displayName, 80);
  if (!displayName) return { ok: false, error: "A display name (up to 80 characters) is required." };
  if (displayNameTaken(displayName, reserved))
    return { ok: false, error: "Another teacher already uses that display name." };
  const email = text(input.email, 120);
  if (email === null || (email && !EMAIL_RE.test(email)))
    return { ok: false, error: "Enter a valid email address or leave it blank." };
  if (!isDepartment(input.department)) return { ok: false, error: "Select a department." };
  const department = input.department;
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  const now = new Date().toISOString();
  const account: TeacherAccount = {
    id: randomUUID(),
    username,
    displayName,
    email,
    department,
    passwordHash: hashPassword(input.password as string),
    active: input.active === false ? false : true,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  save([...load(), account]);
  return { ok: true, value: toPublic(account) };
}

export function updateTeacherAccount(
  id: string,
  input: TeacherInput,
  reserved: Set<string> = new Set(),
): Result<PublicTeacherAccount> {
  const accounts = load();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return { ok: false, error: "Teacher account not found." };
  const next = { ...accounts[index] };

  if (input.displayName !== undefined) {
    const displayName = text(input.displayName, 80);
    if (!displayName) return { ok: false, error: "A display name (up to 80 characters) is required." };
    if (displayNameTaken(displayName, reserved, id))
      return { ok: false, error: "Another teacher already uses that display name." };
    next.displayName = displayName;
  }
  if (input.email !== undefined) {
    const email = text(input.email, 120);
    if (email === null || (email && !EMAIL_RE.test(email)))
      return { ok: false, error: "Enter a valid email address or leave it blank." };
    next.email = email;
  }
  if (input.department !== undefined) {
    if (!isDepartment(input.department)) return { ok: false, error: "Select a department." };
    next.department = input.department;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") return { ok: false, error: "Invalid status." };
    if (next.active && !input.active) next.sessionVersion += 1; // sign out now
    next.active = input.active;
  }
  if (input.password !== undefined) {
    const passwordError = validatePassword(input.password);
    if (passwordError) return { ok: false, error: passwordError };
    next.passwordHash = hashPassword(input.password as string);
    next.sessionVersion += 1;
  }
  next.updatedAt = new Date().toISOString();
  const copy = [...accounts];
  copy[index] = next;
  save(copy);
  return { ok: true, value: toPublic(next) };
}

/** Replaces the password with a random temporary one and returns it once. */
export function resetTeacherPassword(id: string): Result<string> {
  const temporary = randomBytes(9)
    .toString("base64url")
    .replace(/[-_]/g, "x")
    .slice(0, 10);
  const result = updateTeacherAccount(id, { password: temporary });
  return result.ok ? { ok: true, value: temporary } : result;
}

export function deleteTeacherAccount(id: string): boolean {
  const accounts = load();
  const next = accounts.filter((account) => account.id !== id);
  if (next.length === accounts.length) return false;
  save(next);
  return true;
}

export type TeacherLogin =
  | { status: "ok"; account: TeacherAccount }
  | { status: "inactive" }
  | { status: "invalid" }
  | { status: "unknown" };

export function verifyTeacherAccount(username: string, password: string): TeacherLogin {
  const account = findTeacherByUsername(username);
  if (!account) return { status: "unknown" };
  if (!passwordMatches(password, account.passwordHash)) return { status: "invalid" };
  if (!account.active) return { status: "inactive" };
  const accounts = load().map((a) =>
    a.id === account.id ? { ...a, lastLoginAt: new Date().toISOString() } : a,
  );
  save(accounts);
  return { status: "ok", account };
}

/** True while the account exists, is active and the session is not stale. */
export function teacherSessionValid(id: string, version: number): boolean {
  const account = findTeacherById(id);
  return !!account && account.active && account.sessionVersion === version;
}

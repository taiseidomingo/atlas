import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  findTeacherById,
  findTeacherByUsername,
  normalizeUsername,
  teacherSessionValid,
  verifyTeacherAccount,
} from "./teacherAccounts";

export const SESSION_COOKIE = "atlas_teacher";
const SESSION_SECONDS = 60 * 60 * 8;

const globalStore = globalThis as unknown as {
  atlasDevSecret?: string;
  atlasLoginFails?: Map<string, { count: number; until: number }>;
};

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return (globalStore.atlasDevSecret ??= randomBytes(32).toString("hex"));
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type Role = "admin" | "teacher";

export interface Session {
  /** Display name shown in the UI and recorded on room claims. */
  name: string;
  /** Stable login id (lower-case username). */
  id: string;
  role: Role;
}

/** Teacher accounts configured through the TEACHER_ACCOUNTS env variable. */
function envAccounts(): Map<string, { display: string; pin: string }> {
  const map = new Map<string, { display: string; pin: string }>();
  (process.env.TEACHER_ACCOUNTS ?? "").split(";").forEach((entry) => {
    const i = entry.indexOf(":");
    if (i <= 0) return;
    const display = entry.slice(0, i).trim();
    map.set(normalizeUsername(display), { display, pin: entry.slice(i + 1).trim() });
  });
  map.delete(adminName());
  return map;
}

export function adminName(): string {
  return (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase() || "admin";
}

/** Usernames that dashboard-managed teacher accounts may not take. */
export function reservedUsernames(): Set<string> {
  return new Set([adminName(), ...envAccounts().keys()]);
}

/** Read-only list of env-configured teacher logins, for the admin dashboard. */
export function listEnvTeacherNames(): string[] {
  return [...envAccounts().values()].map((account) => account.display);
}

function adminPinValue(): string | null {
  if (process.env.ADMIN_PIN) return process.env.ADMIN_PIN;
  return process.env.NODE_ENV !== "production" ? "admin" : null;
}

/** @deprecated name-based check; use isAdminRequest / getSession().role. */
export function isAdmin(name: string | null): boolean {
  return name?.trim().toLowerCase() === adminName();
}

export type LoginResult =
  | {
      ok: true;
      session: Session;
      /** Present for dashboard-managed accounts. */
      account?: { id: string; version: number };
    }
  | { ok: false; error: string };

const WRONG = "Wrong name or password.";

export function verifyLogin(name: string, pin: string): LoginResult {
  const key = normalizeUsername(name);

  if (key === adminName()) {
    const expected = adminPinValue();
    const ok = safeEqual(pin, expected ?? randomBytes(8).toString("hex"));
    return expected && ok
      ? { ok: true, session: { name: adminName(), id: adminName(), role: "admin" } }
      : { ok: false, error: WRONG };
  }

  const managed = verifyTeacherAccount(key, pin);
  if (managed.status === "ok") {
    const { account } = managed;
    return {
      ok: true,
      session: { name: account.displayName, id: account.username, role: "teacher" },
      account: { id: account.id, version: account.sessionVersion },
    };
  }
  if (managed.status === "inactive") {
    return {
      ok: false,
      error: "This account has been deactivated. Please contact the administrator.",
    };
  }
  if (managed.status === "invalid") return { ok: false, error: WRONG };

  const env = envAccounts().get(key);
  const ok = safeEqual(pin, env?.pin ?? randomBytes(8).toString("hex"));
  return env && ok
    ? { ok: true, session: { name: env.display, id: key, role: "teacher" } }
    : { ok: false, error: WRONG };
}

export function attachSession(response: NextResponse, login: Extract<LoginResult, { ok: true }>): void {
  const payload = Buffer.from(
    JSON.stringify({
      t: login.session.name,
      i: login.session.id,
      r: login.session.role,
      ...(login.account ? { a: login.account.id, v: login.account.version } : {}),
      e: Date.now() + SESSION_SECONDS * 1000,
    }),
  ).toString("base64url");
  response.cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

/** Verified session from the signed cookie, or null. */
export function getSession(request: NextRequest): Session | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof data.t !== "string" ||
      typeof data.e !== "number" ||
      data.e < Date.now()
    )
      return null;
    const id = typeof data.i === "string" ? data.i : normalizeUsername(data.t);
    // Dashboard-managed accounts: reject sessions of deactivated, deleted or
    // reset accounts.
    let name: string = data.t;
    if (typeof data.a === "string") {
      if (typeof data.v !== "number" || !teacherSessionValid(data.a, data.v)) return null;
      // Use the current display name in case an admin renamed the account.
      name = findTeacherById(data.a)?.displayName ?? name;
    } else if (data.r !== "admin" && findTeacherByUsername(id)) {
      // A legacy cookie must not stand in for a managed account.
      return null;
    }
    const role: Role =
      data.r === "admin" || data.r === "teacher"
        ? data.r
        : id === adminName()
          ? "admin"
          : "teacher";
    // An admin session is only valid for the configured admin login.
    if (role === "admin" && id !== adminName()) return null;
    return { name, id, role };
  } catch {
    return null;
  }
}

export function getTeacher(request: NextRequest): string | null {
  return getSession(request)?.name ?? null;
}

export function isAdminRequest(request: NextRequest): boolean {
  return getSession(request)?.role === "admin";
}

/** Returns a 403 response unless the request comes from a signed-in admin. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  return isAdminRequest(request)
    ? null
    : NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

export function getProfessorIdentity(
  request: NextRequest,
): { name: string; id: string } | null {
  const session = getSession(request);
  return session ? { name: session.name, id: session.id } : null;
}

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

export function loginLocked(ip: string): boolean {
  const rec = (globalStore.atlasLoginFails ??= new Map()).get(ip);
  return !!rec && rec.count >= MAX_FAILS && rec.until > Date.now();
}

export function recordLogin(ip: string, success: boolean): void {
  const map = (globalStore.atlasLoginFails ??= new Map());
  if (success) return void map.delete(ip);
  const rec = map.get(ip);
  const fresh = !rec || rec.until < Date.now();
  map.set(ip, {
    count: fresh ? 1 : rec.count + 1,
    until: Date.now() + LOCK_MS,
  });
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

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

export function demoLoginsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ATLAS_DEMO_LOGINS === "1";
}

function accounts(): Map<string, string> {
  const map = new Map(
    (process.env.TEACHER_ACCOUNTS ?? "").split(";").flatMap((entry) => {
      const i = entry.indexOf(":");
      return i > 0
        ? [[entry.slice(0, i).trim().toLowerCase(), entry.slice(i + 1).trim()]]
        : [];
    }),
  );
  if (demoLoginsEnabled()) map.set("demo professor", "1234");

  map.delete(adminName());
  const adminPin = adminPinValue();
  if (adminPin) map.set(adminName(), adminPin);
  return map;
}

function adminName(): string {
  return (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase() || "admin";
}




function adminPinValue(): string | null {
  if (process.env.ADMIN_PIN) return process.env.ADMIN_PIN;
  return process.env.NODE_ENV !== "production" ? "admin" : null;
}

export function isAdmin(name: string | null): boolean {
  return name?.trim().toLowerCase() === adminName();
}

export function verifyLogin(name: string, pin: string): string | null {
  const key = name.trim().toLowerCase();
  const expected = accounts().get(key);
  const ok = safeEqual(pin, expected ?? randomBytes(8).toString("hex"));
  if (!expected || !ok) return null;
  const display = (process.env.TEACHER_ACCOUNTS ?? "")
    .split(";")
    .map((entry) => entry.split(":")[0].trim())
    .find((entry) => entry.toLowerCase() === key);
  return display ?? (key === "demo professor" ? "Demo Professor" : key === adminName() ? adminName() : name.trim());
}

export function attachSession(
  response: NextResponse,
  teacher: string,
  professorId?: string,
): void {
  const id =
    professorId ??
    (process.env.TEACHER_ACCOUNTS ?? "")
      .split(";")
      .map((entry) => entry.split(":")[0].trim())
      .find((entry) => entry.toLowerCase() === teacher.trim().toLowerCase())
      ?.trim()
      .toLowerCase() ??
    teacher.trim().toLowerCase();
  const payload = Buffer.from(
    JSON.stringify({
      t: teacher,
      i: id,
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

export function getTeacher(request: NextRequest): string | null {
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
    return data.t;
  } catch {
    return null;
  }
}

export function getProfessorIdentity(
  request: NextRequest,
): { name: string; id: string } | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof data.t !== "string" ||
      typeof data.i !== "string" ||
      typeof data.e !== "number" ||
      data.e < Date.now()
    ) {
      return null;
    }
    return { name: data.t, id: data.i };
  } catch {
    return null;
  }
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

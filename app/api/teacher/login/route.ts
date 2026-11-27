import { NextRequest, NextResponse } from "next/server";
import {
  attachSession,
  loginLocked,
  recordLogin,
  verifyLogin,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (loginLocked(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 10 minutes." },
      { status: 429 },
    );
  }

  const { name, pin } = await request.json().catch(() => ({}));
  const login =
    typeof name === "string" && typeof pin === "string" && name.trim() && pin
      ? verifyLogin(name, pin)
      : { ok: false as const, error: "Enter your name and password." };
  recordLogin(ip, login.ok);

  if (!login.ok) return NextResponse.json({ error: login.error }, { status: 401 });

  const response = NextResponse.json({
    teacher: login.session.name,
    admin: login.session.role === "admin",
  });
  attachSession(response, login);
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import {
  attachSession,
  loginLocked,
  recordLogin,
  verifyLogin,
} from "@/lib/auth";

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
  const teacher =
    typeof name === "string" && typeof pin === "string"
      ? verifyLogin(name, pin)
      : null;
  recordLogin(ip, !!teacher);

  if (!teacher)
    return NextResponse.json({ error: "Wrong name or PIN." }, { status: 401 });

  const response = NextResponse.json({ teacher });
  attachSession(response, teacher);
  return response;
}

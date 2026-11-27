import { NextRequest, NextResponse } from "next/server";
import { listEnvTeacherNames, requireAdmin, reservedUsernames } from "@/lib/auth";
import { createTeacherAccount, listTeacherAccounts } from "@/lib/teacherAccounts";

export const runtime = "nodejs";

// Teacher account records are admin-only. Password hashes never leave the server.
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(
    {
      accounts: listTeacherAccounts(),
      // Logins configured on the server (TEACHER_ACCOUNTS env variable); read-only here.
      configured: listEnvTeacherNames(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = createTeacherAccount(body, reservedUsernames());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ account: result.value }, { status: 201 });
}

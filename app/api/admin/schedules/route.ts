import { NextRequest, NextResponse } from "next/server";
import { listEnvTeacherNames, requireAdmin } from "@/lib/auth";
import { createSchedule, listSchedules } from "@/lib/faculty";
import { listLocationOptions } from "@/lib/locationOptions";
import { listTeacherAccounts } from "@/lib/teacherAccounts";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

async function handleGET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(
    {
      schedules: listSchedules(),
      teachers: listTeacherAccounts().map((t) => ({
        id: t.id,
        displayName: t.displayName,
        department: t.department,
        active: t.active,
      })),
      otherFaculty: listEnvTeacherNames(),
      locations: listLocationOptions(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function handlePOST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = createSchedule(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ schedule: result.value }, { status: 201 });
}

export const GET = withSharedState(handleGET);
export const POST = withSharedState(handlePOST);

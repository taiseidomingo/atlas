import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listDepartmentAreas, setDepartmentArea } from "@/lib/faculty";
import { listLocationOptions } from "@/lib/locationOptions";
import { listTeacherAccounts } from "@/lib/teacherAccounts";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

async function handleGET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const teachers = listTeacherAccounts();
  return NextResponse.json(
    {
      areas: listDepartmentAreas().map((a) => ({
        ...a,
        teachers: teachers
          .filter((t) => t.department === a.department)
          .map((t) => ({ id: t.id, displayName: t.displayName, active: t.active })),
      })),
      unassigned: teachers
        .filter((t) => !listDepartmentAreas().some((a) => a.department === t.department))
        .map((t) => ({ id: t.id, displayName: t.displayName, active: t.active })),
      locations: listLocationOptions(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Body: { department, location, nodeId } — an empty location clears the area. */
async function handlePATCH(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = setDepartmentArea(body.department, { location: body.location, nodeId: body.nodeId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ area: result.value });
}

export const GET = withSharedState(handleGET);
export const PATCH = withSharedState(handlePATCH);

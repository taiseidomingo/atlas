import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, reservedUsernames } from "@/lib/auth";
import { finishProfessorActivities } from "@/lib/activityLog";
import { listReservations, releaseRoom } from "@/lib/reservation";
import { syncTeacherSchedules, unlinkTeacherSchedules } from "@/lib/faculty";
import {
  deleteTeacherAccount,
  findTeacherById,
  resetTeacherPassword,
  updateTeacherAccount,
} from "@/lib/teacherAccounts";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** Same clean-up as logging out: free the teacher's rooms and close their logs. */
function releaseTeacherRooms(displayName: string) {
  listReservations()
    .filter((reservation) => reservation.professor === displayName)
    .forEach((reservation) => releaseRoom(reservation.nodeId, displayName));
  finishProfessorActivities(displayName);
}

/**
 * Edit a teacher account. Body fields (all optional):
 *   displayName, email, department, active (boolean), password (new password)
 * or { resetPassword: true } to generate a temporary password, which is
 * returned once in the response.
 */
async function handlePATCH(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.resetPassword === true) {
    const reset = resetTeacherPassword(id);
    if (!reset.ok) return NextResponse.json({ error: reset.error }, { status: 404 });
    return NextResponse.json(
      { temporaryPassword: reset.value },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Usernames are permanent: room activity logs are keyed by them.
  const { displayName, email, department, active, password } = body;
  const before = findTeacherById(id);
  const result = updateTeacherAccount(id, {
    displayName,
    email,
    department,
    active,
    password,
  }, reservedUsernames());
  if (!result.ok) {
    const status = result.error === "Teacher account not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  if (
    before &&
    ((before.active && !result.value.active) ||
      before.displayName !== result.value.displayName)
  ) {
    // Claims are recorded under the display name the teacher had.
    releaseTeacherRooms(before.displayName);
  }
  syncTeacherSchedules(id, result.value.displayName, result.value.department);
  return NextResponse.json({ account: result.value });
}

async function handleDELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  const account = findTeacherById(id);
  if (!account || !deleteTeacherAccount(id)) {
    return NextResponse.json({ error: "Teacher account not found." }, { status: 404 });
  }
  releaseTeacherRooms(account.displayName);
  unlinkTeacherSchedules(id);
  return NextResponse.json({ ok: true });
}

export const PATCH = withSharedState(handlePATCH);
export const DELETE = withSharedState(handleDELETE);

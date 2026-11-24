import { NextRequest, NextResponse } from "next/server";
import { clearSession, getTeacher } from "@/lib/auth";
import { listReservations, releaseRoom } from "@/lib/reservation";
import { finishProfessorActivities } from "@/lib/activityLog";

export async function POST(request: NextRequest) {
  const teacher = getTeacher(request);
  if (teacher) {
    listReservations()
      .filter((reservation) => reservation.professor === teacher)
      .forEach((reservation) => releaseRoom(reservation.nodeId, teacher));
    finishProfessorActivities(teacher);
  }
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { getProfessorIdentity, getSession } from "./auth";
import { claimRoom, listReservations, releaseRoom } from "./reservation";
import { listRenamedRoomNames } from "./roomAdmin";
import { withSharedState } from "./persist";

async function handleGET() {
  return NextResponse.json({
    reservations: listReservations(),
    roomNames: listRenamedRoomNames(),
  });
}

async function handlePOST(request: NextRequest) {
  const session = getSession(request);
  const teacher = session?.name ?? null;
  if (!teacher)
    return NextResponse.json(
      { error: "Please log in as a teacher." },
      { status: 401 },
    );
  if (session?.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot claim rooms." },
      { status: 403 },
    );
  }

  const { nodeId } = await request.json().catch(() => ({}));
  if (typeof nodeId !== "string" || !nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const identity = getProfessorIdentity(request);
  const result = claimRoom(
    nodeId,
    teacher,
    identity?.id ?? teacher.trim().toLowerCase(),
  );
  if (result.ok) return NextResponse.json({ reservation: result.reservation });
  if (result.reason === "not_found")
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (result.reason === "not_claimable") {
    return NextResponse.json(
      { error: "Only classrooms can be claimed" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: `Already claimed by ${result.heldBy}` },
    { status: 409 },
  );
}

async function handleDELETE(request: NextRequest) {
  const session = getSession(request);
  const teacher = session?.name ?? null;
  if (!teacher)
    return NextResponse.json(
      { error: "Please log in as a teacher." },
      { status: 401 },
    );
  if (session?.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot manage room claims." },
      { status: 403 },
    );
  }

  const { nodeId } = await request.json().catch(() => ({}));
  const outcome = releaseRoom(nodeId, teacher);
  if (outcome === "missing")
    return NextResponse.json(
      { error: "That room was not claimed" },
      { status: 404 },
    );
  if (outcome === "not_yours")
    return NextResponse.json(
      { error: "You can only release your own room" },
      { status: 403 },
    );
  return NextResponse.json({ released: nodeId });
}

export const GET = withSharedState(handleGET);
export const POST = withSharedState(handlePOST);
export const DELETE = withSharedState(handleDELETE);

import { NextRequest, NextResponse } from "next/server";
import { getTeacher } from "./auth";
import { claimRoom, listReservations, releaseRoom } from "./reservation";

export async function GET() {
  return NextResponse.json({ reservations: listReservations() });
}

export async function POST(request: NextRequest) {
  const teacher = getTeacher(request);
  if (!teacher)
    return NextResponse.json(
      { error: "Please log in as a teacher." },
      { status: 401 },
    );

  const { nodeId } = await request.json().catch(() => ({}));
  if (typeof nodeId !== "string" || !nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const result = claimRoom(nodeId, teacher);
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

export async function DELETE(request: NextRequest) {
  const teacher = getTeacher(request);
  if (!teacher)
    return NextResponse.json(
      { error: "Please log in as a teacher." },
      { status: 401 },
    );

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

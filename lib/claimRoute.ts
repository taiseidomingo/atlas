import { NextRequest, NextResponse } from "next/server";
import { claimRoom, listReservations, releaseRoom } from "../lib/reservation";

function isAdmin(adminKey: unknown): boolean {
  const secret = process.env.ADMIN_KEY;
  return Boolean(secret) && adminKey === secret;
}

export async function GET() {
  return NextResponse.json({ reservations: listReservations() });
}

export async function POST(request: NextRequest) {
  const { nodeId, claimedBy, adminKey } = await request.json();

  if (!isAdmin(adminKey)) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  if (!nodeId || !claimedBy || typeof claimedBy !== "string") {
    return NextResponse.json(
      { error: "nodeId and claimedBy (professor name) are required" },
      { status: 400 },
    );
  }

  const result = claimRoom(nodeId, claimedBy.trim());

  if (!result.ok) {
    if (result.reason === "not_claimable") {
      return NextResponse.json(
        { error: "That location is not a claimable room" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ reservation: result.reservation });
}

export async function DELETE(request: NextRequest) {
  const { nodeId, adminKey } = await request.json();

  if (!isAdmin(adminKey)) {
    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  }

  const released = releaseRoom(nodeId);

  if (!released) {
    return NextResponse.json(
      { error: "That room was not claimed" },
      { status: 404 },
    );
  }

  return NextResponse.json({ released: nodeId });
}

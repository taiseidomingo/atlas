import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listClaimableRooms } from "@/lib/rooms";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

async function handleGET(request: NextRequest) {
  const session = getSession(request);
  return NextResponse.json({
    teacher: session?.name ?? null,
    role: session?.role ?? null,
    admin: session?.role === "admin",
    rooms: session ? listClaimableRooms() : [],
  });
}

export const GET = withSharedState(handleGET);

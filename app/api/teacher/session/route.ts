import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listClaimableRooms } from "@/lib/rooms";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  return NextResponse.json({
    teacher: session?.name ?? null,
    role: session?.role ?? null,
    admin: session?.role === "admin",
    rooms: session ? listClaimableRooms() : [],
  });
}

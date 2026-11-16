import { NextRequest, NextResponse } from "next/server";
import { demoLoginsEnabled, getTeacher } from "@/lib/auth";
import { listClaimableRooms } from "@/lib/rooms";

export async function GET(request: NextRequest) {
  const teacher = getTeacher(request);
  return NextResponse.json({
    teacher,
    demo: demoLoginsEnabled(),
    rooms: teacher ? listClaimableRooms() : [],
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getTeacher, isAdmin } from "@/lib/auth";
import { listManagedNameItems, listRenamedRoomNames, renameManagedName } from "@/lib/roomAdmin";

export const runtime = "nodejs";

// Display names are public map data. The editable catalog is returned only to admins.
export async function GET(request: NextRequest) {
  const admin = isAdmin(getTeacher(request));
  return NextResponse.json({
    names: listRenamedRoomNames(),
    ...(admin ? { items: listManagedNameItems() } : {}),
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(getTeacher(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (
    typeof body.id !== "string" ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json(
      { error: "A location ID and non-empty name are required." },
      { status: 400 },
    );
  }
  if (body.name.trim().length > 100) {
    return NextResponse.json(
      { error: "Names must be 100 characters or fewer." },
      { status: 400 },
    );
  }
  if (!renameManagedName(body.id, body.name)) {
    return NextResponse.json(
      { error: "Location not found or name is invalid." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    names: listRenamedRoomNames(),
    items: isAdmin(getTeacher(request)) ? listManagedNameItems() : undefined,
  });
}

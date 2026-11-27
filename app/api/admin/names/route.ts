import { NextRequest, NextResponse } from "next/server";
import { getTeacher, isAdmin } from "@/lib/auth";
import { listManagedNameItems, renameManagedName } from "@/lib/roomAdmin";

export const runtime = "nodejs";

function requireAdmin(request: NextRequest): NextResponse | null {
  return isAdmin(getTeacher(request))
    ? null
    : NextResponse.json({ error: "Admin access required." }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ items: listManagedNameItems() });
}

export async function PATCH(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

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
    names: { [body.id]: body.name.trim() },
    items: listManagedNameItems(),
  });
}

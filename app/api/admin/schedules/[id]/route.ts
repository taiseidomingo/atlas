import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteSchedule, updateSchedule } from "@/lib/faculty";
import { withSharedState } from "@/lib/persist";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function handlePATCH(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = updateSchedule(id, body);
  if (!result.ok) {
    const status = result.error === "Schedule not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ schedule: result.value });
}

async function handleDELETE(request: NextRequest, context: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!deleteSchedule(id)) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = withSharedState(handlePATCH);
export const DELETE = withSharedState(handleDELETE);

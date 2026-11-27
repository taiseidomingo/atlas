import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listReservations } from "@/lib/reservation";
import { getRoomName, renameRoom } from "@/lib/roomAdmin";
import { campusGraph } from "@/lib/graph";
import { filterActivities, listActivities } from "@/lib/activityLog";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "week";
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const professorFilter = (
    searchParams.get("professor") ??
    ""
  ).trim().toLowerCase();
  const roomFilter = (searchParams.get("room") ?? "").trim().toLowerCase();
  const floorFilter = (searchParams.get("floor") ?? "").trim().toLowerCase();
  const statusFilter = (
    searchParams.get("status") ??
    ""
  ).trim().toLowerCase();
  const dateFilter = searchParams.get("date") ?? "";
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  if (period === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    from = new Date(now);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else if (period === "custom" && customFrom && customTo) {
    from = new Date(`${customFrom}T00:00:00`);
    to = new Date(`${customTo}T23:59:59`);
  }

  let activities = filterActivities(listActivities(), {
    period: period as "day" | "week" | "month" | "custom",
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (dateFilter) {
    activities = activities.filter((activity) =>
      activity.checkIn.startsWith(dateFilter),
    );
  }
  if (professorFilter) {
    activities = activities.filter(
      (activity) =>
        activity.professor.toLowerCase().includes(professorFilter) ||
        activity.professorId.toLowerCase().includes(professorFilter),
    );
  }
  if (roomFilter) {
    activities = activities.filter(
      (activity) =>
        activity.roomName.toLowerCase().includes(roomFilter) ||
        activity.nodeId.toLowerCase().includes(roomFilter),
    );
  }
  if (floorFilter) {
    activities = activities.filter((activity) =>
      activity.floor.toLowerCase().includes(floorFilter),
    );
  }
  if (statusFilter) {
    activities = activities.filter((activity) =>
      activity.status.toLowerCase() === statusFilter,
    );
  }
  if (search) {
    activities = activities.filter((activity) =>
      [
        activity.professor,
        activity.professorId,
        activity.roomName,
        activity.nodeId,
        activity.floor,
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }
  const reservations = listReservations();
  const usage = campusGraph.nodes
    .filter((node) => node.claimable)
    .map((node) => {
      const roomActivities = activities.filter(
        (activity) => activity.nodeId === node.id,
      );
      return {
        id: node.id,
        name: getRoomName(node.id, node.name),
        uses: roomActivities.length,
        uniqueProfessors: new Set(
          roomActivities.map((activity) => activity.professor),
        ).size,
        currentlyClaimed: reservations.some(
          (reservation) => reservation.nodeId === node.id,
        ),
      };
    })
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
  const usedRooms = usage.filter((room) => room.uses > 0);
  const unusedRooms = usage.filter((room) => room.uses === 0);
  const mostUsed = usedRooms[0] ?? null;
  const leastUsed =
    unusedRooms.length > 0
      ? unusedRooms[unusedRooms.length - 1]
      : usage[usage.length - 1] ?? null;
  const claimDate = (timestamp: string) => timestamp.slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const allActivities = listActivities();
  const claimsToday = allActivities.filter((activity) =>
    claimDate(activity.checkIn) === today,
  ).length;
  const claimsThisWeek = allActivities.filter(
    (activity) => new Date(activity.checkIn) >= weekStart,
  ).length;
  const professorCounts = new Map<string, number>();
  allActivities.forEach((activity) => {
    const key = activity.professor || "Unknown professor";
    professorCounts.set(key, (professorCounts.get(key) ?? 0) + 1);
  });
  const topProfessors = [...professorCounts.entries()]
    .map(([name, claims]) => ({ name, claims }))
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 5);
  const occupiedRooms = reservations.map((reservation) => ({
    nodeId: reservation.nodeId,
    roomName: getRoomName(reservation.nodeId, reservation.roomName),
    professor: reservation.professor,
  }));
  const occupiedIds = new Set(occupiedRooms.map((room) => room.nodeId));
  const availableRooms = campusGraph.nodes
    .filter((node) => node.claimable && !occupiedIds.has(node.id))
    .map((node) => ({
      nodeId: node.id,
      roomName: getRoomName(node.id, node.name),
    }));

  const trends: { date: string; uses: number }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    trends.push({
      date,
      uses: activities.filter((activity) =>
        activity.checkIn.startsWith(date),
      ).length,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({
    usage,
    totalUses: activities.length,
    claimsToday,
    claimsThisWeek,
    topProfessors,
    occupiedRooms,
    availableRooms,
    totalProfessors: new Set(activities.map((activity) => activity.professor))
      .size,
    mostUsed,
    leastUsed,
    frequentlyUsed: usedRooms.slice(0, 5),
    notUsed: unusedRooms,
    trends,
    recentActivity: listActivities().slice(0, 20),
    activities,
  });
}

export async function PATCH(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (
    typeof body.nodeId !== "string" ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json(
      { error: "nodeId and name are required." },
      { status: 400 },
    );
  }
  if (!renameRoom(body.nodeId, body.name)) {
    return NextResponse.json(
      { error: "Room not found." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

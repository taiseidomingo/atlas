import { NextRequest, NextResponse } from "next/server";
import { campusGraph } from "@/lib/graph";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nodeId, claimedBy, adminKey } = body;

  if (adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Invalid Admin Key " }, { status: 401 });
  }

  const node = campusGraph.nodes.find((n) => n.id === nodeId);

  if (!node) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  node.claimed = true;
  node.claimedBy = claimedBy ?? "unknown instructor";

  return NextResponse.json({ node });
}

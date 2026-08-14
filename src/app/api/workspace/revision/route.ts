import { NextResponse } from "next/server";
import { getWorkspaceRevision } from "@/data/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  const revision = await getWorkspaceRevision();
  if (revision === null) return NextResponse.json({ configured: false }, { status: 503 });
  return NextResponse.json({ configured: true, revision }, { headers: { "Cache-Control": "no-store" } });
}

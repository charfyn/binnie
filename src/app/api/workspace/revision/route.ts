import { NextResponse } from "next/server";
import { getWorkspaceRevision } from "@/data/tasks";
import { AuthenticationRequiredError, AuthorizationError, PasswordChangeRequiredError } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const revision = await getWorkspaceRevision();
    if (revision === null) return NextResponse.json({ configured: false }, { status: 503 });
    return NextResponse.json({ configured: true, revision }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: "Password change required" }, { status: 403 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}

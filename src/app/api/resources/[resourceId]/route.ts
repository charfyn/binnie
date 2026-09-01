import { NextResponse } from "next/server";
import { getAuthorizedTaskResource } from "@/data/tasks";
import { AuthenticationRequiredError, AuthorizationError, PasswordChangeRequiredError } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ resourceId: string }> }) {
  try {
    const { resourceId } = await context.params;
    const resource = await getAuthorizedTaskResource(resourceId);
    if (!resource) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(resource.content, {
      headers: {
        "Content-Type": resource.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(resource.fileName || resource.label)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return new NextResponse("Authentication required", { status: 401 });
    if (error instanceof PasswordChangeRequiredError) return new NextResponse("Password change required", { status: 403 });
    if (error instanceof AuthorizationError) return new NextResponse("Forbidden", { status: 403 });
    throw error;
  }
}

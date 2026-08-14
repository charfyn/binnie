import { NextResponse } from "next/server";
import { getAuthorizedTaskResource } from "@/data/tasks";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ resourceId: string }> }) {
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
}

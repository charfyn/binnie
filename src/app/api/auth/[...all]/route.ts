import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isMultiUserAuthEnabled } from "@/lib/auth-activation";

const handler = toNextJsHandler(auth);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isMultiUserAuthEnabled()) return new Response(null, { status: 404 });
  return handler.GET(request);
}

export async function POST(request: Request, context: RouteContext<"/api/auth/[...all]">) {
  if (!isMultiUserAuthEnabled()) return new Response(null, { status: 404 });
  const { all } = await context.params;
  // Deliberately expose only the two browser POST operations this MVP needs.
  // This prevents Better Auth's generic email sign-up/reset endpoints from
  // accidentally becoming a public registration or recovery path.
  const endpoint = all.join("/");
  if (!new Set(["sign-in/username", "sign-out"]).has(endpoint)) return new Response(null, { status: 404 });
  return handler.POST(request);
}

export async function PATCH(request: Request) {
  if (!isMultiUserAuthEnabled()) return new Response(null, { status: 404 });
  return handler.PATCH(request);
}

export async function PUT(request: Request) {
  if (!isMultiUserAuthEnabled()) return new Response(null, { status: 404 });
  return handler.PUT(request);
}

export async function DELETE(request: Request) {
  if (!isMultiUserAuthEnabled()) return new Response(null, { status: 404 });
  return handler.DELETE(request);
}

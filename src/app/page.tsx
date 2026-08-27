import BinnieApp from "./app";
import { getWorkspaceSnapshot } from "@/data/tasks";
import { hasDatabaseConfiguration } from "@/lib/db";
import { isMultiUserAuthEnabled } from "@/lib/auth-activation";
import { getCurrentUserContext } from "@/lib/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (hasDatabaseConfiguration() && !isMultiUserAuthEnabled()) {
    return <main className="flex min-h-dvh items-center justify-center bg-background p-5"><section className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-7 shadow-[0_18px_54px_rgb(35_41_61_/_0.10)] sm:p-9"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">Binnie access rollout</p><h1 className="binnie-heading mt-3 text-3xl font-bold text-foreground">Multi-user access is waiting for activation.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Finish the Owner bootstrap and security checks, then set <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] text-foreground">BINNIE_MULTI_USER_AUTH_ENABLED=true</code> to enable sign-in.</p></section></main>;
  }
  if (hasDatabaseConfiguration()) {
    const currentUser = await getCurrentUserContext();
    if (currentUser?.requiresPasswordChange) redirect("/account/create-password");
  }
  const initialSnapshot = await getWorkspaceSnapshot();
  // With PostgreSQL configured, a missing snapshot means the visitor has no
  // active Binnie account/session. Never fall back to a browser-local actor.
  if (!initialSnapshot && hasDatabaseConfiguration()) redirect("/login");
  return <BinnieApp initialSnapshot={initialSnapshot ?? undefined} />;
}

import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/access";
import CreatePasswordForm from "./create-password-form";

export const dynamic = "force-dynamic";

export default async function CreatePasswordPage() {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) redirect("/login");
  if (!currentUser.requiresPasswordChange) redirect("/");
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5"><section className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-7 shadow-[0_18px_54px_rgb(35_41_61_/_0.10)] sm:p-9"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">Binnie</p><h1 className="binnie-heading mt-3 text-3xl font-bold text-foreground">Create your password</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">You’re signing in for the first time. Choose a password only you know.</p><CreatePasswordForm /></section></main>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessConsole } from "@/data/access";
import { AuthenticationRequiredError, AuthorizationError, PasswordChangeRequiredError } from "@/lib/access";
import AccessConsole from "./access-console";

export const dynamic = "force-dynamic";

async function loadAccessConsole() {
  try {
    return { kind: "data" as const, data: await getAccessConsole() };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { kind: "authentication" as const };
    if (error instanceof PasswordChangeRequiredError) return { kind: "password-change" as const };
    if (error instanceof AuthorizationError) return { kind: "forbidden" as const };
    throw error;
  }
}

export default async function PeopleAccessPage() {
  const result = await loadAccessConsole();
  if (result.kind === "authentication") redirect("/login");
  if (result.kind === "password-change") redirect("/account/create-password");
  if (result.kind === "forbidden") return <main className="flex min-h-dvh items-center justify-center bg-background p-5"><section className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-7 text-center"><h1 className="binnie-heading text-2xl font-bold text-foreground">People &amp; access</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your current access does not include member management.</p><Link href="/" className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Back to Binnie</Link></section></main>;
  return <AccessConsole initialData={result.data} />;
}

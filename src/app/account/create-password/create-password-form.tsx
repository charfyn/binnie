"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPasswordAction, type CreatePasswordState } from "./actions";

const initialState: CreatePasswordState = { message: "" };

export default function CreatePasswordForm() {
  const [state, action, pending] = useActionState(createPasswordAction, initialState);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.replace("/");
    router.refresh();
  }, [router, state.ok]);
  return <form action={action} className="mt-7 space-y-4">
    <label className="block text-sm font-medium text-foreground" htmlFor="password">New password
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </label>
    <label className="block text-sm font-medium text-foreground" htmlFor="confirmation">Confirm password
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </label>
    <p className="text-[12px] text-muted-foreground">Use at least 8 characters.</p>
    <button className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Continue to Binnie"}</button>
    {state.message ? <p aria-live="polite" className="text-center text-sm leading-6 text-muted-foreground">{state.message}</p> : null}
  </form>;
}

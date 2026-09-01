"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, rememberMe: true }),
      });
      if (!response.ok) {
        setMessage("Incorrect username or password.");
        return;
      }
      const result = await response.json() as { requiresPasswordChange?: boolean };
      router.replace(result.requiresPasswordChange ? "/account/create-password" : "/");
      router.refresh();
    } catch {
      setMessage("Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} className="mt-7 space-y-4">
      <label className="block text-sm font-medium text-foreground" htmlFor="username">Username</label>
      <input
        id="username"
        name="username"
        type="text"
        autoComplete="username"
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        placeholder="yourusername"
      />
      <label className="block text-sm font-medium text-foreground" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
      <button className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign In"}
      </button>
      <button type="button" onClick={() => setMessage("Contact your Binnie workspace administrator to reset your password.")} className="block w-full text-center text-sm text-primary hover:underline">Forgot password?</button>
      {message ? <p aria-live="polite" className="text-center text-sm leading-6 text-muted-foreground">{message}</p> : null}
    </form>
  );
}

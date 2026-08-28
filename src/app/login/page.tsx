"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";

export default function LoginPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => setUser(data.user));
  }, []);

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: mode, name, email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Authentication failed.");
      setBusy(false);
      return;
    }
    setUser(data.user);
    window.location.href = "/shelter";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <section className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Shelter network</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{mode === "login" ? "Sign in" : "Create an account"}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to publish and maintain a shelter report.
          </p>
        </div>
        <form onSubmit={submitCredentials} className="space-y-3">
          {mode === "register" && <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />}
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (8+ characters)" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <button disabled={busy} type="submit" className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
        <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="w-full text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">{mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}</button>
        <div className="flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />or<span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /></div>
        {user ? (
          <Link href="/shelter" className="block w-full rounded-lg bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-700">Continue as {user.name}</Link>
        ) : (
          <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"><span className="text-lg font-bold">G</span>Continue with Google</a>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}

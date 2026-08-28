"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";

export default function LoginPage() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => setUser(data.user));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <section className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Shelter network</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Sign in with Google
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Use your verified Google account to publish and maintain a shelter report.
          </p>
        </div>
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

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <form className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div className="flex flex-col items-center justify-center gap-1">
          <h1 className="text-4xl font-bold text-green-600 dark:text-green-600">
            Sign in
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-300">
            Access your Shurokkha Route account.
          </p>
        </div>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
          Email
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
          <input
            type="password"
            name="password"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Sign in
        </button>

        <Link
          href="/"
          className="block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to dashboard
        </Link>
      </form>
    </main>
  );
}

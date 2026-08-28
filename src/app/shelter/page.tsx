"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import type { ShelterReport } from "@/types";

const initialForm = { name: "", address: "", lat: "", lng: "", status: "Active", currentCapacity: "0", maxCapacity: "100", contactPhone: "", notes: "" };

export default function ShelterPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [reports, setReports] = useState<ShelterReport[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data) => {
      setUser(data.user);
      if (data.user) fetch("/api/shelter-reports").then((response) => response.json()).then((reportData) => setReports(reportData.reports ?? []));
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving report...");
    const response = await fetch("/api/shelter-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, coordinates: { lat: Number(form.lat), lng: Number(form.lng) }, currentCapacity: Number(form.currentCapacity), maxCapacity: Number(form.maxCapacity) }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Could not save report."); return; }
    setReports((current) => [data.report, ...current]);
    setForm(initialForm);
    setMessage("Shelter report submitted.");
  }

  async function signOut() {
    await fetch("/api/auth/google", { method: "POST" });
    window.location.href = "/login";
  }

  if (!user) return <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950"><section className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-zinc-900"><h1 className="text-lg font-semibold">Sign in required</h1><p className="mt-2 text-sm text-zinc-500">Sign in with Google to manage a shelter report.</p><Link href="/login" className="mt-5 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">Go to sign in</Link></section></main>;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-start justify-between gap-4"><div><Link href="/" className="text-sm text-green-700 hover:underline dark:text-green-400">Back to dashboard</Link><h1 className="mt-3 text-3xl font-bold">Shelter operations</h1><p className="mt-1 text-sm text-zinc-500">Signed in as {user.email}</p></div><button type="button" onClick={signOut} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Sign out</button></header>
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900"><h2 className="text-lg font-semibold">Report a shelter location</h2><p className="mt-1 text-sm text-zinc-500">Reports are attributed to your Google account and require review before becoming official network data.</p>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Shelter name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Address<input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Latitude<input required type="number" step="any" value={form.lat} onChange={(event) => setForm({ ...form, lat: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Longitude<input required type="number" step="any" value={form.lng} onChange={(event) => setForm({ ...form, lng: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800"><option>Active</option><option>At Risk</option><option>Full</option><option>Closed</option></select></label>
            <label className="text-sm font-medium">Current occupants<input required type="number" min="0" value={form.currentCapacity} onChange={(event) => setForm({ ...form, currentCapacity: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Total capacity<input required type="number" min="1" value={form.maxCapacity} onChange={(event) => setForm({ ...form, maxCapacity: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium">Contact phone<input value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <label className="text-sm font-medium sm:col-span-2">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-800" /></label>
            <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Submit shelter report</button>{message && <span className="text-sm text-zinc-500">{message}</span>}</div>
          </form>
        </section>
        {reports.length > 0 && <section className="mt-6 rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900"><h2 className="text-lg font-semibold">Your submitted reports</h2><div className="mt-4 space-y-3">{reports.map((report) => <div key={report.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700"><div className="flex justify-between gap-3"><strong>{report.name}</strong><span>{report.status}</span></div><p className="mt-1 text-zinc-500">{report.address} · {report.currentCapacity}/{report.maxCapacity} occupants</p></div>)}</div></section>}
      </div>
    </main>
  );
}
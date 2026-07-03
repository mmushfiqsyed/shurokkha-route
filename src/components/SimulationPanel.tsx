export default function SimulationPanel() {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        Simulation Panel
      </h2>
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        <p className="italic">No active simulation running.</p>
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-zinc-100 dark:bg-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 cursor-not-allowed"
        >
          Start Simulation
        </button>
      </div>
    </section>
  );
}

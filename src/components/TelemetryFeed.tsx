export default function TelemetryFeed() {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        AI Telemetry Feed
      </h2>
      <div className="max-h-64 overflow-y-auto space-y-2">
        <p className="text-xs text-zinc-400 italic">
          Awaiting telemetry data...
        </p>
      </div>
    </section>
  );
}

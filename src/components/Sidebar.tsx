import SimulationPanel from "./SimulationPanel";
import TelemetryFeed from "./TelemetryFeed";

export default function Sidebar() {
  return (
    <aside className="flex w-[18rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4">
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white text-sm font-bold">
          SR
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">Shurokkha Route</h1>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Disaster Management Dashboard
          </p>
        </div>
      </div>
      <SimulationPanel />
      <TelemetryFeed />
    </aside>
  );
}

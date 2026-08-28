import ChatPanel from "@/components/ChatPanel";
import TelemetryFeed from "@/components/TelemetryFeed";
import LoginPanel from "@/components/LoginPanel";
import ChatbotButton from "@/components/ChatbotButton";
import type { AgentThoughtEvent, CalculationStep } from "@/types";

interface SidebarProps {
  onSubmit: (message: string) => void;
  loading: boolean;
  steps: CalculationStep[];
  thoughts: AgentThoughtEvent[];
  isProcessing: boolean;
}

export default function Sidebar({ onSubmit, loading, steps, thoughts, isProcessing }: SidebarProps) {
  return (
    <aside className="relative flex h-full min-h-0 w-[min(22rem,100vw)] shrink-0 flex-col gap-4 overflow-hidden border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="shrink-0">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-3">
          <div className="flex h-8 w-8 mb-1 items-center justify-center rounded-md">
            <img src="/favicon.ico" alt="Logo" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Shurokkha Route</h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Disaster Management Dashboard
            </p>
          </div>
        </div>
      </div>
      <div className="shrink-0">
        <ChatPanel onSubmit={onSubmit} loading={loading} />
      </div>
      <div className="min-h-0 w-full max-w-[320px] flex-1 self-center">
        <TelemetryFeed steps={steps} thoughts={thoughts} isProcessing={isProcessing} />
      </div>
      <div className="relative z-30 mt-auto w-full max-w-[320px] shrink-0 self-center">
        <LoginPanel />
      </div>
      <ChatbotButton onSubmit={onSubmit} loading={loading} />
    </aside>
  );
}

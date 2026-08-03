"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AgentThoughtEvent, CalculationStep } from "@/types";

interface TelemetryFeedProps {
  steps: CalculationStep[];
  thoughts: AgentThoughtEvent[];
  isProcessing: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  "Hazard Analyst": "#ef4444",
  "Logistics and shelter agent": "#22c55e",
  "Routing and operations agent": "#3b82f6",
  "Response Commander": "#a855f7",
  "Advisory agent": "#f59e0b",
};

const FALLBACK_COLORS = ["#14b8a6", "#ec4899", "#6366f1", "#84cc16", "#f97316"];

interface ThoughtGroup {
  agent: string;
  items: AgentThoughtEvent[];
  color: string;
}

function groupThoughts(thoughts: AgentThoughtEvent[]): ThoughtGroup[] {
  const order: string[] = [];
  const map = new Map<string, AgentThoughtEvent[]>();
  for (const t of thoughts) {
    const key = t.agent ?? "Crew";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(t);
  }
  return order.map((agent, index) => ({
    agent,
    items: map.get(agent)!,
    color: AGENT_COLORS[agent] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));
}

function truncate(text: string, max = 180): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function TelemetryFeed({ steps, thoughts, isProcessing }: TelemetryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupThoughts(thoughts), [thoughts]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thoughts]);

  const idle = thoughts.length === 0 && !isProcessing && steps.length === 0;
  const processing = isProcessing && thoughts.length === 0;

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        Agent Thought Processes
      </h2>
      <div ref={containerRef} className="max-h-[32rem] overflow-y-auto space-y-3">
        {idle && <p className="text-xs text-zinc-400 italic">Awaiting scenario input...</p>}
        {processing && <p className="text-xs text-zinc-400 italic">Starting live CrewAI run...</p>}

        {groups.map((group) => (
          <div key={group.agent} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                {group.agent}
              </span>
            </div>
            {group.items.map((item, index) => (
              <div
                key={index}
                className="ml-3.5 border-l-2 pl-2"
                style={{ borderColor: `${group.color}55` }}
              >
                {item.kind === "thought" && (
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    {item.thought && (
                      <p className="italic">{item.thought}</p>
                    )}
                    {item.tool && (
                      <p className="mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        Using {item.tool}
                        {item.toolInput ? `(${truncate(item.toolInput, 80)})` : ""}
                      </p>
                    )}
                    {item.text && item.text !== item.thought && (
                      <p className="mt-0.5 text-[10px] text-zinc-400">{truncate(item.text, 160)}</p>
                    )}
                  </div>
                )}
                {item.kind === "tool_start" && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Calling tool {item.tool}
                    {item.toolInput ? `(${truncate(item.toolInput, 80)})` : ""}
                  </p>
                )}
                {item.kind === "tool_end" && item.output && (
                  <p className="text-[10px] text-zinc-400">Tool result: {truncate(item.output, 160)}</p>
                )}
                {item.kind === "agent_start" && (
                  <p className="text-[11px] text-zinc-400">Starting task...</p>
                )}
                {item.kind === "agent_end" && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Done{item.output ? `: ${truncate(item.output, 160)}` : ""}
                  </p>
                )}
                {item.kind === "info" && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.message}</p>
                )}
                {item.kind === "crew_start" && (
                  <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Crew kickoff started</p>
                )}
                {item.kind === "crew_end" && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Crew run complete</p>
                )}
                {item.kind === "error" && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{item.message}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

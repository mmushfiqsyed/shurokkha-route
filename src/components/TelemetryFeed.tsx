"use client";

import { useEffect, useRef } from "react";
import type { CalculationStep } from "@/types";

interface TelemetryFeedProps {
  steps: CalculationStep[];
  isProcessing: boolean;
}

export default function TelemetryFeed({ steps, isProcessing }: TelemetryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps]);

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
        Agent Activity
      </h2>
      <div ref={containerRef} className="max-h-48 overflow-y-auto space-y-1.5">
        {steps.length === 0 && !isProcessing && (
          <p className="text-xs text-zinc-400 italic">Awaiting scenario input...</p>
        )}
        {isProcessing && steps.length === 0 && (
          <p className="text-xs text-zinc-400 italic">Processing scenario...</p>
        )}
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex items-start gap-2 text-xs"
          >
            <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-zinc-600 dark:text-zinc-300">{step.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
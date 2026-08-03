"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MapCanvasClient from "@/components/MapCanvasClient";
import { buildStepsAndRecommendation } from "@/lib/build-result";
import type { AgentThoughtEvent, CalculationStep, CrewResultPayload, Recommendation } from "@/types";

function parseSSEChunk(buffer: string): { rest: string; events: { type: string; data: string }[] } {
  const events: { type: string; data: string }[] = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf("\n\n")) >= 0) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let type = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) events.push({ type, data });
  }
  return { rest, events };
}

export default function DashboardPage() {
  const [steps, setSteps] = useState<CalculationStep[]>([]);
  const [thoughts, setThoughts] = useState<AgentThoughtEvent[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (message: string) => {
    setLoading(true);
    setSteps([]);
    setThoughts([]);
    setRecommendation(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSteps([{ type: "error", message: err.error ?? "Something went wrong." }]);
        return;
      }

      if (!res.body) {
        setSteps([{ type: "error", message: "No response stream from the analysis service." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { rest, events } = parseSSEChunk(buffer);
        buffer = rest;

        for (const event of events) {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          switch (event.type) {
            case "thought":
            case "agent_start":
            case "agent_end":
            case "tool_start":
            case "tool_end":
            case "crew_start":
            case "crew_end":
              setThoughts((prev) => [
                ...prev,
                {
                  kind: event.type,
                  agent: (payload.agent as string | undefined) ?? undefined,
                  thought: (payload.thought as string | null | undefined) ?? null,
                  tool: (payload.tool as string | null | undefined) ?? null,
                  toolInput: (payload.tool_input as string | null | undefined) ?? null,
                  text: (payload.text as string | null | undefined) ?? null,
                  output: (payload.output as string | null | undefined) ?? null,
                  message: (payload.message as string | undefined) ?? undefined,
                  ts: Date.now(),
                } satisfies AgentThoughtEvent,
              ]);
              break;
            case "info":
              setThoughts((prev) => [
                ...prev,
                {
                  kind: "info",
                  agent: (payload.agent as string | undefined) ?? "Crew",
                  message: payload.message as string,
                  ts: Date.now(),
                } satisfies AgentThoughtEvent,
              ]);
              break;
            case "result": {
              const built = buildStepsAndRecommendation(payload.data as unknown as CrewResultPayload);
              setSteps(built.steps);
              setRecommendation(built.recommendation);
              break;
            }
            case "error":
              setSteps([{ type: "error", message: (payload.message as string) ?? "Analysis failed." }]);
              break;
            case "ping":
              break;
          }
        }
      }
    } catch {
      setSteps([{ type: "error", message: "Failed to connect to the analysis service." }]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar
        onSubmit={handleSubmit}
        loading={loading}
        steps={steps}
        thoughts={thoughts}
        isProcessing={loading}
      />
      <main className="flex flex-1 flex-col">
        <MapCanvasClient steps={steps} recommendation={recommendation} />
      </main>
    </div>
  );
}

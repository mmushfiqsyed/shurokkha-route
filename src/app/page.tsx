"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MapCanvasClient from "@/components/MapCanvasClient";
import { buildStepsAndRecommendation } from "@/lib/build-result";
import type { AgentThoughtEvent, AgentThoughtKind, CalculationStep, Coordinates, CrewResultPayload, Recommendation } from "@/types";

function normalizeThoughtPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  if (out.tool_input !== undefined && out.toolInput === undefined) {
    out.toolInput = out.tool_input;
  }
  return out;
}

function parseSSEChunk(buffer: string): { rest: string; events: { type: string; data: string }[] } {
  const events: { type: string; data: string }[] = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf("\n\n")) >= 0) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let type = "message";
    const dataParts: string[] = [];
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("event:")) {
        type = trimmed.slice(6).trim();
      } else if (trimmed.startsWith("data:")) {
        dataParts.push(trimmed.slice(5).trim());
      }
    }
    if (dataParts.length > 0) {
      events.push({ type, data: dataParts.join("") });
    }
  }
  return { rest, events };
}

export default function DashboardPage() {
  const [steps, setSteps] = useState<CalculationStep[]>([]);
  const [thoughts, setThoughts] = useState<AgentThoughtEvent[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  const handleSubmit = useCallback(async (message: string) => {
    setLoading(true);
    setSteps([]);
    setThoughts([]);
    setRecommendation(null);

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, location: userLocation }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSteps([{ type: "error", message: err.error ?? "Something went wrong." }]);
        setLoading(false);
        return;
      }

      if (!res.body) {
        setSteps([{ type: "error", message: "No response stream from the analysis service." }]);
        setLoading(false);
        return;
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { rest, events } = parseSSEChunk(buffer);
        buffer = rest;

        for (const event of events) {
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(event.data) as Record<string, unknown>;
          } catch {
            continue;
          }

          switch (event.type) {
            case "thought":
            case "agent_start":
            case "agent_end":
            case "tool_start":
            case "tool_end":
            case "crew_start":
            case "crew_end": {
              const norm = normalizeThoughtPayload(payload);
              const thoughtEvent: AgentThoughtEvent = {
                kind: event.type as AgentThoughtKind,
                agent: (norm.agent as string | undefined) ?? undefined,
                thought: (norm.thought as string | null | undefined) ??
                  (norm.text as string | null | undefined) ??
                  null,
                tool: (norm.tool as string | null | undefined) ?? null,
                toolInput: (norm.toolInput as string | null | undefined) ??
                  (norm.tool_input as string | null | undefined) ??
                  null,
                text: (norm.text as string | null | undefined) ??
                  (norm.thought as string | null | undefined) ??
                  null,
                output: (norm.output as string | null | undefined) ?? null,
                message: (norm.message as string | undefined) ?? undefined,
                ts: Date.now(),
              };
              setThoughts((prev) => [...prev, thoughtEvent]);
              break;
            }
            case "info": {
              const infoAgent = (payload.agent as string | undefined) ?? "Crew";
              const infoMessage = (payload.message as string | undefined) ??
                (payload.text as string | undefined) ??
                "";
              setThoughts((prev) => [
                ...prev,
                {
                  kind: "info",
                  agent: infoAgent,
                  message: infoMessage,
                  ts: Date.now(),
                } satisfies AgentThoughtEvent,
              ]);
              break;
            }
            case "result": {
              const data = payload.data as Record<string, unknown> | undefined;
              if (data) {
                const built = buildStepsAndRecommendation(
                  data as unknown as CrewResultPayload
                );
                setSteps(built.steps);
                setRecommendation(built.recommendation);
              }
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
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors
        }
      }
      setLoading(false);
    }
  }, [userLocation]);

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
        <MapCanvasClient
          steps={steps}
          recommendation={recommendation}
          onLocationChange={setUserLocation}
        />
      </main>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MapCanvasClient from "@/components/MapCanvasClient";
import LoginPanel from "@/components/LoginPanel";
import ChatbotButton from "@/components/ChatbotButton";

import { buildStepsAndRecommendation } from "@/lib/build-result";
import type {
  AgentThoughtEvent,
  AgentThoughtKind,
  CalculationStep,
  Coordinates,
  CrewResultPayload,
  Recommendation,
} from "@/types";

function normalizeThoughtPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  if (out.tool_input !== undefined && out.toolInput === undefined) {
    out.toolInput = out.tool_input;
  }

  return out;
}

function parseSSEChunk(
  buffer: string
): {
  rest: string;
  events: { type: string; data: string }[];
} {
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
      events.push({
        type,
        data: dataParts.join(""),
      });
    }
  }

  return {
    rest,
    events,
  };
}

function extractAdvisorySteps(output: string): string {
  if (!output) return "";

  const cleaned = output
    .replace(/\r/g, "")
    .replace(/```/g, "")
    .trim();

  // Handles:
  // steps=['1. Shelter in place.', '2. Await rescue...']
  const match = cleaned.match(/steps\s*=\s*\[([\s\S]*?)\]/i);

  if (!match) return "";

  const content = match[1];

  const steps = Array.from(
    content.matchAll(/['"]((?:\\.|[^'"])*)['"]/g)
  )
    .map((match) => match[1])
    .filter(Boolean);

  if (steps.length === 0) return "";

  return steps
    .map((step, index) => {
      const cleanedStep = step
        .replace(/\\'/g, "'")
        .replace(/^\d+\.\s*/, "")
        .trim();

      return `${index + 1}. ${cleanedStep}`;
    })
    .join("\n");
}

export default function DashboardPage() {
  const [steps, setSteps] = useState<CalculationStep[]>([]);
  const [thoughts, setThoughts] = useState<AgentThoughtEvent[]>([]);
  const [recommendation, setRecommendation] =
    useState<Recommendation | null>(null);

  const [advisoryText, setAdvisoryText] = useState("");

  const [loading, setLoading] = useState(false);

  const [userLocation, setUserLocation] =
    useState<Coordinates | null>(null);

  const handleSubmit = useCallback(
    async (message: string) => {
      // IMPORTANT: mark the run as active immediately.
      setLoading(true);

      setSteps([]);
      setThoughts([]);
      setRecommendation(null);
      setAdvisoryText("");

      let reader: ReadableStreamDefaultReader<Uint8Array> | null =
        null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            location: userLocation,
          }),
        });

        if (!res.ok) {
          let errorMessage = "Something went wrong.";

          try {
            const err = await res.json();
            errorMessage = err.error ?? errorMessage;
          } catch {
            // Keep default error message.
          }

          setSteps([
            {
              type: "error",
              message: errorMessage,
            },
          ]);

          setThoughts((prev) => [
            ...prev,
            {
              kind: "error",
              agent: "Crew",
              message: errorMessage,
              ts: Date.now(),
            },
          ]);

          return;
        }

        if (!res.body) {
          const errorMessage =
            "No response stream from the analysis service.";

          setSteps([
            {
              type: "error",
              message: errorMessage,
            },
          ]);

          return;
        }

        reader = res.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true,
          });

          const parsed = parseSSEChunk(buffer);

          buffer = parsed.rest;

          for (const event of parsed.events) {
            let payload: Record<string, unknown>;

            try {
              payload = JSON.parse(event.data) as Record<
                string,
                unknown
              >;
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
                const norm =
                  normalizeThoughtPayload(payload);

                const agent =
                  (norm.agent as string | undefined) ??
                  undefined;

                const output =
                  (norm.output as
                    | string
                    | null
                    | undefined) ?? null;

                const thoughtEvent: AgentThoughtEvent = {
                  kind: event.type as AgentThoughtKind,

                  agent,

                  thought:
                    (norm.thought as
                      | string
                      | null
                      | undefined) ??
                    (norm.text as
                      | string
                      | null
                      | undefined) ??
                    null,

                  tool:
                    (norm.tool as
                      | string
                      | null
                      | undefined) ??
                    null,

                  toolInput:
                    (norm.toolInput as
                      | string
                      | null
                      | undefined) ??
                    (norm.tool_input as
                      | string
                      | null
                      | undefined) ??
                    null,

                  text:
                    (norm.text as
                      | string
                      | null
                      | undefined) ??
                    (norm.thought as
                      | string
                      | null
                      | undefined) ??
                    null,

                  output,

                  message:
                    (norm.message as
                      | string
                      | undefined) ??
                    undefined,

                  ts: Date.now(),
                };

                setThoughts((prev) => [
                  ...prev,
                  thoughtEvent,
                ]);

                /*
                 * IMPORTANT:
                 * Capture the Advisory agent result immediately.
                 *
                 * This prevents a later "result" event from
                 * accidentally replacing it with an empty string.
                 */
                if (
                  event.type === "agent_end" &&
                  agent &&
                  agent
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "") ===
                    "advisoryagent" &&
                  output
                ) {
                  const extracted =
                    extractAdvisorySteps(output);

                  if (extracted) {
                    setAdvisoryText(extracted);
                  }
                }

                break;
              }

              case "info": {
                const infoAgent =
                  (payload.agent as string | undefined) ??
                  "Crew";

                const infoMessage =
                  (payload.message as string | undefined) ??
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
                const data =
                  payload.data as
                    | Record<string, unknown>
                    | undefined;

                if (data) {
                  const crewResult =
                    data as unknown as CrewResultPayload;

                  const built =
                    buildStepsAndRecommendation(
                      crewResult
                    );

                  setSteps(built.steps);
                  setRecommendation(
                    built.recommendation
                  );

                  /*
                   * Only replace advisoryText if the result
                   * actually contains one.
                   *
                   * Otherwise preserve the Advisory agent_end
                   * answer we already captured.
                   */
                  if (
                    typeof crewResult.advisoryText ===
                      "string" &&
                    crewResult.advisoryText.trim()
                  ) {
                    setAdvisoryText(
                      crewResult.advisoryText.trim()
                    );
                  }
                }

                break;
              }

              case "error": {
                const errorMessage =
                  (payload.message as string) ??
                  "Analysis failed.";

                setSteps([
                  {
                    type: "error",
                    message: errorMessage,
                  },
                ]);

                setThoughts((prev) => [
                  ...prev,
                  {
                    kind: "error",
                    agent: "Crew",
                    message: errorMessage,
                    ts: Date.now(),
                  },
                ]);

                break;
              }

              case "ping":
                break;
            }
          }
        }
      } catch (error) {
        console.error(error);

        const errorMessage =
          "Failed to connect to the analysis service.";

        setSteps([
          {
            type: "error",
            message: errorMessage,
          },
        ]);

        setThoughts((prev) => [
          ...prev,
          {
            kind: "error",
            agent: "Crew",
            message: errorMessage,
            ts: Date.now(),
          },
        ]);
      } finally {
        if (reader) {
          try {
            await reader.cancel();
          } catch {
            // Ignore cancellation errors.
          }
        }

        setLoading(false);
      }
    },
    [userLocation]
  );

  return (
    <div className="relative flex h-full min-h-0">
      <Sidebar
        onSubmit={handleSubmit}
        loading={loading}
        steps={steps}
        thoughts={thoughts}
        isProcessing={loading}
      />

      <main className="relative z-0 flex min-w-0 flex-1 flex-col">
        <MapCanvasClient
          steps={steps}
          recommendation={recommendation}
          onLocationChange={setUserLocation}
        />
      </main>

      <div className="fixed right-4 top-4 z-[9999]">
        <LoginPanel />
      </div>

      <ChatbotButton
        onSubmit={handleSubmit}
        loading={loading}
        advisoryText={advisoryText}
      />
    </div>
  );
}
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

const FALLBACK_COLORS = [
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#f97316",
];

function normalizeAgentName(name: string): string {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  const map: Record<string, string> = {
    hazardanalyst: "Hazard Analyst",

    logisticsandshelter: "Logistics and shelter agent",
    logisticsandshelteragent: "Logistics and shelter agent",
    logistics: "Logistics and shelter agent",

    routingandoperations: "Routing and operations agent",
    routingandoperationsagent: "Routing and operations agent",
    routing: "Routing and operations agent",

    responsecommander: "Response Commander",
    commander: "Response Commander",

    advisoryagent: "Advisory agent",
    advisory: "Advisory agent",
  };

  return map[lower] ?? name;
}

interface ThoughtGroup {
  agent: string;
  items: AgentThoughtEvent[];
  color: string;
}

function groupThoughts(thoughts: AgentThoughtEvent[]): ThoughtGroup[] {
  const order: string[] = [];
  const map = new Map<string, AgentThoughtEvent[]>();

  for (const thought of thoughts) {
    const raw = thought.agent ?? "Crew";
    const key = normalizeAgentName(raw);

    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }

    map.get(key)!.push(thought);
  }

  return order.map((agent, index) => ({
    agent,
    items: map.get(agent)!,
    color:
      AGENT_COLORS[agent] ??
      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));
}

/**
 * Only use truncation for technical telemetry such as tool arguments/results.
 * Agent thoughts themselves should NEVER be truncated.
 */
function truncate(text: string, max = 240): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function cleanOutput(text: string): string {
  return text
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractField(output: string, field: string): string | null {
  const patterns = [
    new RegExp(`${field}\\s*=\\s*'([^']*)'`, "i"),
    new RegExp(`${field}\\s*=\\s*"([^"]*)"`, "i"),
    new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, "i"),
    new RegExp(`"${field}"\\s*:\\s*([^,}]+)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractList(output: string, field: string): string[] {
  const match = output.match(
    new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, "is")
  );

  if (!match?.[1]) return [];

  return Array.from(
    match[1].matchAll(/['"]([^'"]+)['"]/g)
  ).map((m) => m[1].trim());
}

/**
 * Converts CrewAI/Pydantic-style output into a short human-readable summary.
 */
function formatAgentResult(
  agent: string,
  output: string
): { title: string; lines: string[] } {
  const cleaned = cleanOutput(output);

  if (!cleaned) {
    return {
      title: "Assessment complete",
      lines: [],
    };
  }

  // -------------------------
  // Hazard Analyst
  // -------------------------
  if (agent === "Hazard Analyst") {
    const severity = extractField(cleaned, "severity");
    const zone = extractField(cleaned, "zone");
    const risks = extractList(cleaned, "secondary_risks");
    const notes = extractField(cleaned, "notes");

    const lines: string[] = [];

    if (severity) {
      lines.push(`Severity: ${severity}/5`);
    }

    if (zone) {
      lines.push(`Zone: ${zone}`);
    }

    if (risks.length > 0) {
      lines.push(`Secondary risks: ${risks.join(", ")}`);
    }

    if (notes) {
      lines.push(notes);
    }

    return {
      title: "Hazard assessment",
      lines:
        lines.length > 0
          ? lines
          : [truncate(cleaned, 220)],
    };
  }

  // -------------------------
  // Logistics / Shelter
  // -------------------------
  if (agent === "Logistics and shelter agent") {
    const recommended =
      extractField(cleaned, "recommended_shelter_id");

    const viable = extractList(cleaned, "viable_shelters");

    const notes = extractField(cleaned, "notes");

    const lines: string[] = [];

    if (recommended) {
      lines.push(`Recommended shelter: ${recommended}`);
    }

    if (viable.length > 0) {
      lines.push(`Viable shelters: ${viable.length}`);
    }

    if (notes) {
      lines.push(notes);
    }

    return {
      title: "Shelter assessment",
      lines:
        lines.length > 0
          ? lines
          : [truncate(cleaned, 220)],
    };
  }

  // -------------------------
  // Routing
  // -------------------------
  if (agent === "Routing and operations agent") {
    const shelter = extractField(
      cleaned,
      "selected_shelter_id"
    );

    const route = extractField(
      cleaned,
      "selected_route_id"
    );

    const safeRoutes = extractList(
      cleaned,
      "safe_routes"
    );

    const assets = extractList(
      cleaned,
      "available_assets"
    );

    const travelMode = extractField(
      cleaned,
      "travel_mode"
    );

    const notes = extractField(cleaned, "notes");

    const lines: string[] = [];

    if (shelter) {
      lines.push(`Destination: ${shelter}`);
    }

    if (route) {
      lines.push(`Selected route: ${route}`);
    }

    if (safeRoutes.length > 0) {
      lines.push(`Safe routes checked: ${safeRoutes.length}`);
    }

    if (assets.length > 0) {
      lines.push(`Available assets: ${assets.length}`);
    }

    if (travelMode) {
      lines.push(`Travel mode: ${travelMode}`);
    }

    if (notes) {
      lines.push(notes);
    }

    return {
      title: "Routing assessment",
      lines:
        lines.length > 0
          ? lines
          : [truncate(cleaned, 220)],
    };
  }

  // -------------------------
  // Commander
  // -------------------------
  if (agent === "Response Commander") {
    const action = extractField(
      cleaned,
      "priority_action"
    );

    const route = extractField(
      cleaned,
      "route_id"
    );

    const justification = extractField(
      cleaned,
      "justification"
    );

    const lines: string[] = [];

    if (action) {
      lines.push(
        `Priority action: ${action}`
      );
    }

    if (route) {
      lines.push(
        `Route: ${route}`
      );
    }

    if (justification) {
      lines.push(
        justification
      );
    }

    return {
      title: "Command decision",
      lines:
        lines.length > 0
          ? lines
          : [truncate(cleaned, 220)],
    };
  }

  // -------------------------
  // Advisory
  // -------------------------
  if (agent === "Advisory agent") {
    const steps = extractList(
      cleaned,
      "steps"
    );

    if (steps.length > 0) {
      return {
        title: "Final advisory",
        lines: steps.slice(0, 4).map(
          (step) => step
        ),
      };
    }

    // Fallback for plain text advisory output.
    const numbered = Array.from(
      cleaned.matchAll(
        /(?:^|\s)(\d+)\.\s*(.*?)(?=\s+\d+\.\s*|$)/g
      )
    ).map((m) => m[2].trim());

    if (numbered.length > 0) {
      return {
        title: "Final advisory",
        lines: numbered.slice(0, 4),
      };
    }

    return {
      title: "Final advisory",
      lines: [truncate(cleaned, 260)],
    };
  }

  return {
    title: "Agent result",
    lines: [truncate(cleaned, 260)],
  };
}

function ThoughtEntry({
  item,
  color,
}: {
  item: AgentThoughtEvent;
  color: string;
}) {
  if (item.kind === "thought") {
    return (
      <div
        className="border-l-2 pl-3"
        style={{
          borderColor: `${color}55`,
          animation: "thoughtIn 0.2s ease-out both",
        }}
      >
        {item.thought && (
          <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-zinc-600 dark:text-zinc-300">
            {item.thought}
          </p>
        )}

        {item.tool && (
          <div className="mt-2 rounded-md bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-900/60">
            <p className="break-words text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              <span className="mr-1">🔧</span>
              Using {item.tool}
            </p>

            {item.toolInput && (
              <p className="mt-0.5 break-words text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
                {truncate(item.toolInput, 180)}
              </p>
            )}
          </div>
        )}

        {item.text &&
          item.text !== item.thought &&
          item.text.trim() !== "" && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
              {item.text}
            </p>
          )}
      </div>
    );
  }

  if (item.kind === "tool_start") {
    return (
      <div
        className="border-l-2 pl-3"
        style={{ borderColor: `${color}35` }}
      >
        <div className="rounded-md bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/20">
          <p className="break-words text-[10px] font-medium text-amber-700 dark:text-amber-400">
            🔧 Calling {item.tool || "tool"}
          </p>

          {item.toolInput && (
            <p className="mt-0.5 break-words text-[10px] leading-4 text-amber-700/70 dark:text-amber-500/70">
              {truncate(item.toolInput, 180)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "tool_end") {
    return (
      <div
        className="border-l-2 pl-3"
        style={{ borderColor: `${color}35` }}
      >
        <p className="text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
          ✓ Tool completed
        </p>

        {item.output && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
            {truncate(item.output, 220)}
          </p>
        )}
      </div>
    );
  }

  if (item.kind === "agent_start") {
    return (
      <div
        className="border-l-2 pl-3"
        style={{ borderColor: `${color}35` }}
      >
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
          ● Working…
        </p>
      </div>
    );
  }

  if (item.kind === "agent_end") {
    const formatted = formatAgentResult(
      normalizeAgentName(item.agent ?? "Agent"),
      item.output ?? ""
    );

    return (
      <div
        className="border-l-2 pl-3"
        style={{
          borderColor: `${color}70`,
          animation: "thoughtIn 0.25s ease-out both",
        }}
      >
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              ✓
            </span>

            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
              {formatted.title}
            </span>
          </div>

          {formatted.lines.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {formatted.lines.map((line, index) => (
                <p
                  key={`${item.ts}-${index}`}
                  className="break-words text-[11px] leading-4 text-zinc-600 dark:text-zinc-300"
                >
                  {item.agent === "Advisory agent"
                    ? `• ${line}`
                    : line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.kind === "crew_start") {
    return (
      <div className="rounded-md bg-zinc-100 px-2.5 py-2 dark:bg-zinc-800">
        <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
          Crew analysis started
        </p>
      </div>
    );
  }

  if (item.kind === "crew_end") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          ✓ Crew analysis complete
        </p>
      </div>
    );
  }

  if (item.kind === "info") {
    return (
      <div className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
        <p className="whitespace-pre-wrap break-words text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
          {item.message}
        </p>
      </div>
    );
  }

  if (item.kind === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 dark:border-red-900/40 dark:bg-red-950/20">
        <p className="whitespace-pre-wrap break-words text-[10px] leading-4 text-red-600 dark:text-red-400">
          {item.message}
        </p>
      </div>
    );
  }

  return null;
}

export default function TelemetryFeed({
  steps,
  thoughts,
  isProcessing,
}: TelemetryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => groupThoughts(thoughts),
    [thoughts]
  );

  useEffect(() => {
  const container = containerRef.current;

  if (!container) return;

  const distanceFromBottom =
    container.scrollHeight -
    container.scrollTop -
    container.clientHeight;

  // Only auto-scroll when the user is already near the bottom.
  // This prevents the UI from fighting the user's manual scrolling.
  if (distanceFromBottom < 120) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}, [thoughts]);

  const idle =
    thoughts.length === 0 &&
    !isProcessing &&
    steps.length === 0;

  const processing =
    isProcessing &&
    thoughts.length === 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            Agent Thought Processes
          </h2>

          <p className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">
            Live multi-agent activity
          </p>
        </div>

        {isProcessing && (
          <span className="flex items-center gap-1.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            LIVE
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2"
      >
        {idle && (
          <div className="rounded-md border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
              Awaiting scenario input…
            </p>
          </div>
        )}

        {processing && (
          <div className="rounded-md border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Starting live CrewAI run…
              </p>
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-5">
            {groups.map((group) => (
              <div
                key={group.agent}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: group.color,
                    }}
                  />

                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                    {group.agent}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map(
                    (item, index) => (
                      <ThoughtEntry
                        key={`${group.agent}-${item.kind}-${item.ts}-${index}`}
                        item={item}
                        color={group.color}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes thoughtIn {
          from {
            opacity: 0;
            transform: translateY(3px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
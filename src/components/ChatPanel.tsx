"use client";

import { useState, useRef, useEffect } from "react";

interface ChatPanelProps {
  onSubmit: (message: string) => void;
  loading: boolean;
}

export default function ChatPanel({ onSubmit, loading }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setInput("");
  }

  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
          Disaster Scenario
        </h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Flood in Sylhet, 2 people with limited mobility"
                disabled={loading}
                className="box-border w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap gap-1">
            {QUICK_SCENARIOS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setInput(s.message);
                  onSubmit(s.message);
                }}
                disabled={loading}
                className="rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </section>
  );
}

const QUICK_SCENARIOS = [
  { label: "Flood — Sylhet", message: "Flood in Sylhet, 2 people with limited mobility" },
  { label: "Cyclone — Chittagong", message: "Cyclone in Chittagong, 5 people, normal mobility" },
  { label: "Earthquake — Dhaka", message: "Earthquake in Dhaka, 3 people, injured" },
  { label: "Fire — Khulna", message: "Fire in Khulna, 1 person, limited mobility" },
];
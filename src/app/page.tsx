"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MapCanvasClient from "@/components/MapCanvasClient";
import type { CalculationStep, Recommendation } from "@/types";

export default function DashboardPage() {
  const [steps, setSteps] = useState<CalculationStep[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (message: string) => {
    setLoading(true);
    setSteps([]);
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

      const data: { steps: CalculationStep[]; recommendation: Recommendation } = await res.json();
      setSteps(data.steps);
      setRecommendation(data.recommendation);
    } catch {
      setSteps([{ type: "error", message: "Failed to connect to the analysis service." }]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar onSubmit={handleSubmit} loading={loading} steps={steps} isProcessing={loading} />
      <main className="flex flex-1 flex-col">
        <MapCanvasClient steps={steps} recommendation={recommendation} />
      </main>
    </div>
  );
}

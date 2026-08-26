"use client";

import dynamic from "next/dynamic";
import type { CalculationStep, Recommendation } from "@/types";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
      Loading map...
    </div>
  ),
});

interface MapCanvasClientProps {
  steps: CalculationStep[];
  recommendation: Recommendation | null;
}

export default function MapCanvasClient({ steps, recommendation }: MapCanvasClientProps) {
  return <MapCanvas steps={steps} recommendation={recommendation} />;
}

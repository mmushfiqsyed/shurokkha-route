"use client";

import dynamic from "next/dynamic";
import type { CalculationStep, Recommendation } from "@/types";
import type { Coordinates } from "@/types";

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
  onLocationChange: (location: Coordinates | null) => void;
}

export default function MapCanvasClient({ steps, recommendation, onLocationChange }: MapCanvasClientProps) {
  return <MapCanvas steps={steps} recommendation={recommendation} onLocationChange={onLocationChange} />;
}

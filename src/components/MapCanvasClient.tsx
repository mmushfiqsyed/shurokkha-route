"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
      Loading map...
    </div>
  ),
});

export default function MapCanvasClient() {
  return <MapCanvas />;
}

"use client";

import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const BANGLADESH_BOUNDS: [[number, number], [number, number]] = [
  [20.5, 88.0],
  [26.5, 92.7],
];

const DEFAULT_CENTER: [number, number] = [23.7, 90.4];
const DEFAULT_ZOOM = 7;

export default function MapCanvas() {
  return (
    <div className="relative flex-1">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="h-full w-full"
        maxBounds={BANGLADESH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}

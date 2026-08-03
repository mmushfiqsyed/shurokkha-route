"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, ZoomControl, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { CalculationStep, Recommendation } from "@/types";
import type { Shelter, Route, Asset, Coordinates } from "@/types";
import sheltersJson from "@/data/shelters.json";
import routesJson from "@/data/routes.json";
import assetsJson from "@/data/assets.json";
import { routeCrossesWater, waterBodiesData } from "@/lib/geo";

const sheltersData = sheltersJson as Shelter[];
const routesData = routesJson as Route[];
const assetsData = assetsJson as Asset[];

const BANGLADESH_BOUNDS: [[number, number], [number, number]] = [
  [20.5, 88.0],
  [26.5, 92.7],
];

const DEFAULT_CENTER: [number, number] = [23.7, 90.4];
const DEFAULT_ZOOM = 7;

const DISASTER_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const SHELTER_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:2px;border:2px solid white;box-shadow:0 0 6px rgba(34,197,94,0.5)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const ASSET_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="background:#f59e0b;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(245,158,11,0.5)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface MapCanvasProps {
  steps: CalculationStep[];
  recommendation: Recommendation | null;
}

export default function MapCanvas({ steps, recommendation }: MapCanvasProps) {
  const mapRef = useRef<L.Map | null>(null);

  const disasterCoords: Coordinates | null = steps.length > 0
    ? (steps[0].data as Record<string, unknown>)?.coords as Coordinates | undefined ?? null
    : null;

  const recommendedShelter = recommendation?.shelter ?? null;
  const recommendedRoute = recommendation?.route ?? null;
  const recommendedAssets = recommendation?.assets ?? [];

  const recommendedRouteCrossing = recommendedRoute ? routeCrossesWater(recommendedRoute) : null;

  const checkedRoutes: Route[] = [];
  const checkedShelters: Shelter[] = [];
  const checkedAssets: Asset[] = [];

  for (const step of steps) {
    if (step.type === "route_safe" || step.type === "route_blocked") {
      const routeId = step.data?.routeId as string | undefined;
      if (routeId) {
        const route = routesData.find((r) => r.id === routeId);
        if (route && !checkedRoutes.find((r) => r.id === route.id)) {
          checkedRoutes.push(route);
        }
      }
    }
    if (step.type === "shelter_selected" || step.type === "shelter_evaluation") {
      const shelterId = step.data?.shelterId as string | undefined;
      if (shelterId) {
        const shelter = sheltersData.find((s) => s.id === shelterId);
        if (shelter && !checkedShelters.find((s) => s.id === shelter.id)) {
          checkedShelters.push(shelter);
        }
      }
    }
    if (step.type === "asset_check") {
      const assets = step.data?.assets as Asset[] | undefined;
      if (assets) {
        for (const asset of assets) {
          if (!checkedAssets.find((a) => a.id === asset.id)) {
            checkedAssets.push(asset);
          }
        }
      }
    }
  }

  useEffect(() => {
    if (recommendedShelter && mapRef.current) {
      const center: [number, number] = [recommendedShelter.coordinates.lat, recommendedShelter.coordinates.lng];
      mapRef.current.flyTo(center, 10, { duration: 1.5 });
    }
  }, [recommendedShelter]);

  return (
    <div className="relative flex-1">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="h-full w-full"
        maxBounds={BANGLADESH_BOUNDS}
        maxBoundsViscosity={1.0}
        ref={mapRef}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {waterBodiesData.map((water) => (
          <Polyline
            key={water.id}
            positions={water.path.map((p) => [p.lat, p.lng] as [number, number])}
            color="#60a5fa"
            weight={3}
            opacity={0.55}
          >
            <Popup>{water.name}</Popup>
          </Polyline>
        ))}

        {disasterCoords && (
          <Marker position={[disasterCoords.lat, disasterCoords.lng]} icon={DISASTER_ICON}>
            <Popup>Disaster Location</Popup>
          </Marker>
        )}

        {recommendedShelter && (
          <Marker position={[recommendedShelter.coordinates.lat, recommendedShelter.coordinates.lng]} icon={SHELTER_ICON}>
            <Popup>{recommendedShelter.name} — {recommendedShelter.status}</Popup>
          </Marker>
        )}

        {checkedShelters.map((shelter) =>
          shelter.id !== recommendedShelter?.id ? (
            <Marker key={shelter.id} position={[shelter.coordinates.lat, shelter.coordinates.lng]} icon={SHELTER_ICON}>
              <Popup>{shelter.name} — {shelter.status}</Popup>
            </Marker>
          ) : null
        )}

        {checkedRoutes.map((route) => {
          const crossing = routeCrossesWater(route);
          const isRecommended = recommendedRoute?.id === route.id && !recommendedRouteCrossing;
          let color = route.status === "Safe" ? (isRecommended ? "#22c55e" : "#3b82f6") : "#ef4444";
          let dashArray: string | undefined = route.status !== "Safe" ? "10 10" : undefined;
          let popupText = `${route.name} — ${route.status}`;
          if (crossing) {
            color = "#dc2626";
            dashArray = "6 8";
            popupText = `${route.name} — BLOCKED: crosses ${crossing.name}. Evacuation routes may not cross water bodies.`;
          }
          return (
            <Polyline
              key={route.id}
              positions={route.path.map((p) => [p.lat, p.lng] as [number, number])}
              color={color}
              weight={isRecommended ? 5 : 3}
              opacity={isRecommended ? 1 : 0.7}
              dashArray={dashArray}
            >
              <Popup>{popupText}</Popup>
            </Polyline>
          );
        })}

        {checkedAssets.map((asset) => (
          <Marker key={asset.id} position={[asset.coordinates.lat, asset.coordinates.lng]} icon={ASSET_ICON}>
            <Popup>{asset.name} — {asset.type} ({asset.status})</Popup>
          </Marker>
        ))}

        {recommendedRoute && (
          <Polyline
            positions={recommendedRoute.path.map((p) => [p.lat, p.lng] as [number, number])}
            color={recommendedRouteCrossing ? "#dc2626" : "#22c55e"}
            weight={6}
            opacity={1}
            dashArray={recommendedRouteCrossing ? "6 8" : undefined}
          >
            <Popup>
              {recommendedRouteCrossing
                ? `Blocked: "${recommendedRoute.name}" crosses ${recommendedRouteCrossing.name}. A route crossing water is never safe.`
                : `Recommended Route: ${recommendedRoute.name}`}
            </Popup>
          </Polyline>
        )}

        {recommendedAssets.map((asset) => (
          <Marker key={asset.id} position={[asset.coordinates.lat, asset.coordinates.lng]} icon={ASSET_ICON}>
            <Popup>{asset.name} — {asset.type}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { CalculationStep, Coordinates, Recommendation } from "@/types";
import type { Shelter, Route, Asset } from "@/types";
import sheltersJson from "@/data/shelters.json";
import routesJson from "@/data/routes.json";
import assetsJson from "@/data/assets.json";
import { distanceKm, routeCrossesWater, waterBodiesData } from "@/lib/geo";

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
  html: '<div style="background:#22c55e;width:16px;height:16px;border-radius:3px;border:2px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const ASSET_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="background:#f59e0b;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(245,158,11,0.5)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const USER_ICON = L.divIcon({
  className: "custom-marker",
  html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.25),0 0 8px rgba(37,99,235,0.7)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

function MapController({
  recommendedShelter,
  userLocation,
}: {
  recommendedShelter: Shelter | null;
  userLocation: UserLocation | null;
}) {
  const map = useMap();
  const centeredOnUser = useRef(false);

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    if (recommendedShelter) {
      const center: [number, number] = [
        recommendedShelter.coordinates.lat,
        recommendedShelter.coordinates.lng,
      ];
      map.flyTo(center, 10, { duration: 1.5 });
    }
  }, [recommendedShelter, map]);

  useEffect(() => {
    if (userLocation && !centeredOnUser.current) {
      centeredOnUser.current = true;
      map.flyTo([userLocation.lat, userLocation.lng], 11, { duration: 1.2 });
    }
  }, [map, userLocation]);

  return null;
}

interface MapCanvasProps {
  steps: CalculationStep[];
  recommendation: Recommendation | null;
  onLocationChange: (location: Coordinates | null) => void;
}

export default function MapCanvas({ steps, recommendation, onLocationChange }: MapCanvasProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "active" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const disasterCoords: { lat: number; lng: number } | null = steps.length > 0
    ? ((steps[0].data as Record<string, unknown>)?.coords as { lat: number; lng: number } | undefined) ?? null
    : null;
  const locationSource = steps.length > 0
    ? ((steps[0].data as Record<string, unknown>)?.locationSource as "mentioned" | "live" | undefined) ?? "mentioned"
    : "mentioned";
  const routeOrigin = locationSource === "live" ? userLocation : disasterCoords;

  const recommendedShelter = recommendation?.shelter ?? null;
  const recommendedRoute = recommendation?.route ?? null;
  const recommendedAssets = recommendation?.assets ?? [];
  const recommendedRouteCrossing = recommendedRoute ? routeCrossesWater(recommendedRoute) : null;
  function locateUser() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setLocationStatus("locating");
    setLocationError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        onLocationChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus("active");
      },
      (error) => {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setLocationStatus("error");
        setLocationError(error.code === error.PERMISSION_DENIED ? "Location permission was denied." : "Unable to get your location.");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
  }

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, [onLocationChange]);

  const checkedRouteIds: Set<string> = new Set();
  const checkedShelterIds: Set<string> = new Set();
  const checkedAssetIds: Set<string> = new Set();

  for (const step of steps) {
    if (
      step.type === "route_safe" ||
      step.type === "route_blocked" ||
      step.type === "route_selected"
    ) {
      const routeId = step.data?.routeId as string | undefined;
      if (routeId) checkedRouteIds.add(routeId);
    }
    if (step.type === "shelter_selected" || step.type === "shelter_evaluation") {
      const shelterId = step.data?.shelterId as string | undefined;
      if (shelterId) checkedShelterIds.add(shelterId);
      const viableDetails = step.data?.viableDetails as Shelter[] | undefined;
      if (viableDetails) {
        for (const s of viableDetails) checkedShelterIds.add(s.id);
      }
      const unavailableDetails = step.data?.unavailableDetails as Shelter[] | undefined;
      if (unavailableDetails) {
        for (const s of unavailableDetails) checkedShelterIds.add(s.id);
      }
    }
    if (step.type === "asset_check") {
      const assets = step.data?.assets as Asset[] | undefined;
      if (assets) {
        for (const a of assets) checkedAssetIds.add(a.id);
      }
    }
  }

  return (
    <div className="relative flex-1" style={{ minHeight: 0 }}>
      <div className="absolute left-3 top-3 z-[1000] w-[min(20rem,calc(100%-1.5rem))] rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <button
          type="button"
          onClick={locateUser}
          disabled={locationStatus === "locating"}
          className="w-full cursor-pointer rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
        >
          {locationStatus === "locating" ? "Finding your location..." : "Use my live location"}
        </button>
        {locationStatus === "active" && recommendedShelter && userLocation && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
            AI-selected safe shelter: <strong>{recommendedShelter.name}</strong> ({distanceKm(userLocation, recommendedShelter.coordinates).toFixed(1)} km)
          </p>
        )}
        {locationStatus === "active" && !recommendedShelter && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Waiting for the AI to select a safe shelter.</p>
        )}
        {locationError && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{locationError}</p>}
      </div>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        maxBounds={BANGLADESH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <AttributionControl position="bottomleft" />
        <ZoomControl position="bottomleft" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController recommendedShelter={recommendedShelter} userLocation={userLocation} />

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

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
            <Popup>You are here (accuracy: {Math.round(userLocation.accuracy)} m)</Popup>
          </Marker>
        )}

        {routeOrigin && recommendedShelter && (
          <Polyline
            positions={[
              [routeOrigin.lat, routeOrigin.lng],
              [recommendedShelter.coordinates.lat, recommendedShelter.coordinates.lng],
            ]}
            color="#2563eb"
            weight={5}
            opacity={0.9}
            dashArray="10 8"
          >
            <Popup>
              {locationSource === "live" ? "Live location" : "Mentioned location"} to {recommendedShelter.name} ({distanceKm(routeOrigin, recommendedShelter.coordinates).toFixed(1)} km straight-line distance)
            </Popup>
          </Polyline>
        )}

        {sheltersData.map((shelter) => {
          const isRecommended = recommendedShelter?.id === shelter.id;
          const wasChecked = checkedShelterIds.has(shelter.id);
          const icon = isRecommended
            ? SHELTER_ICON
            : wasChecked
              ? L.divIcon({
                  className: "custom-marker",
                  html:
                    '<div style="background:#22c55e;width:14px;height:14px;border-radius:2px;border:2px solid white;box-shadow:0 0 6px rgba(34,197,94,0.5);opacity:0.8"></div>',
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })
              : L.divIcon({
                  className: "custom-marker",
                  html:
                    '<div style="background:#86efac;width:10px;height:10px;border-radius:2px;border:1px solid white;opacity:0.5"></div>',
                  iconSize: [10, 10],
                  iconAnchor: [5, 5],
                });
          const remaining = shelter.maxCapacity - shelter.currentCapacity;
          const popupLabel = isRecommended
            ? `★ RECOMMENDED: ${shelter.name} — ${shelter.status} (${shelter.currentCapacity}/${shelter.maxCapacity}, ${remaining} spots)`
            : wasChecked
              ? `${shelter.name} — ${shelter.status} (${shelter.currentCapacity}/${shelter.maxCapacity})`
              : `${shelter.name} — ${shelter.status}`;
          return (
            <Marker
              key={shelter.id}
              position={[shelter.coordinates.lat, shelter.coordinates.lng]}
              icon={icon}
            >
              <Popup>{popupLabel}</Popup>
            </Marker>
          );
        })}

        {routesData.map((route) => {
          const crossing = routeCrossesWater(route);
          const isRecommended = recommendedRoute?.id === route.id;
          const isChecked = checkedRouteIds.has(route.id);
          const hasRecommendation = !!recommendedRoute;

          if (isRecommended) {
            const color = recommendedRouteCrossing ? "#dc2626" : "#22c55e";
            const dashArray = recommendedRouteCrossing ? "6 8" : undefined;
            const popupText = recommendedRouteCrossing
              ? `${route.name} — BLOCKED: crosses ${recommendedRouteCrossing.name}.`
              : `★ Recommended: ${route.name} — ${route.status}`;
            return (
              <Polyline
                key="recommended-route"
                positions={route.path.map((p) => [p.lat, p.lng] as [number, number])}
                color={color}
                weight={6}
                opacity={1}
                dashArray={dashArray}
              >
                <Popup>{popupText}</Popup>
              </Polyline>
            );
          }

          if (hasRecommendation) return null;

          if (isChecked) {
            const color = route.status === "Safe" ? "#3b82f6" : "#ef4444";
            const dashArray = route.status !== "Safe" ? "8 8" : crossing ? "6 8" : undefined;
            const popupText = crossing
              ? `${route.name} — BLOCKED: crosses ${crossing.name}.`
              : `${route.name} — ${route.status}`;
            return (
              <Polyline
                key={route.id}
                positions={route.path.map((p) => [p.lat, p.lng] as [number, number])}
                color={color}
                weight={3}
                opacity={0.5}
                dashArray={dashArray}
              >
                <Popup>{popupText}</Popup>
              </Polyline>
            );
          }

          return null;
        })}

        {recommendedRoute && disasterCoords && (() => {
          const routeStart = recommendedRoute.path[0];
          const dist = Math.hypot(
            routeStart.lat - disasterCoords.lat,
            routeStart.lng - disasterCoords.lng
          );
          if (dist < 0.05) return null;
          return (
            <Polyline
              key="disaster-to-route"
              positions={[
                [disasterCoords.lat, disasterCoords.lng] as [number, number],
                [routeStart.lat, routeStart.lng] as [number, number],
              ]}
              color="#f59e0b"
              weight={4}
              opacity={0.9}
              dashArray="6 6"
            >
              <Popup>Connecting path from disaster location to route start</Popup>
            </Polyline>
          );
        })()}

        {assetsData.map((asset) => {
          const isRecommended = recommendedAssets.some((a) => a.id === asset.id);
          const isChecked = checkedAssetIds.has(asset.id);
          const shouldShow = isRecommended || isChecked || !recommendation;
          if (!shouldShow) return null;
          const icon = isRecommended
            ? ASSET_ICON
            : L.divIcon({
                className: "custom-marker",
                html:
                  '<div style="background:#f59e0b;width:10px;height:10px;border-radius:50%;border:2px solid white;opacity:0.5"></div>',
                iconSize: [10, 10],
                iconAnchor: [5, 5],
              });
          return (
            <Marker key={asset.id} position={[asset.coordinates.lat, asset.coordinates.lng]} icon={icon}>
              <Popup>
                {asset.name} — {asset.type} ({asset.status})
                {isRecommended ? " ★" : ""}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

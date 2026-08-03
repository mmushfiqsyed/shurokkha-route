import { NextRequest, NextResponse } from "next/server";
import sheltersData from "@/data/shelters.json";
import routesData from "@/data/routes.json";
import assetsData from "@/data/assets.json";
import type { Shelter, Route, Asset, Coordinates, CalculationStep, Recommendation } from "@/types";

function parseDisaster(message: string): {
  disasterType: string;
  location: string;
  coords: Coordinates | null;
  people: number;
  mobility: string;
} {
  const lower = message.toLowerCase();

  let disasterType = "Flood";
  if (lower.includes("earthquake")) disasterType = "Earthquake";
  else if (lower.includes("cyclone")) disasterType = "Cyclone";
  else if (lower.includes("fire")) disasterType = "Fire";
  else if (lower.includes("flood")) disasterType = "Flood";

  let location = "";
  let coords: Coordinates | null = null;
  const locationKeywords: Record<string, Coordinates> = {
    sylhet: { lat: 24.898, lng: 91.875 },
    dhaka: { lat: 23.774, lng: 90.375 },
    chittagong: { lat: 22.335, lng: 91.815 },
    khulna: { lat: 22.845, lng: 89.54 },
    rajshahi: { lat: 24.374, lng: 88.604 },
    barisal: { lat: 22.701, lng: 90.353 },
    rangpur: { lat: 25.746, lng: 89.251 },
    mirpur: { lat: 23.822, lng: 90.365 },
  };

  for (const [name, coordinate] of Object.entries(locationKeywords)) {
    if (lower.includes(name)) {
      location = name;
      coords = coordinate;
      break;
    }
  }

  const peopleMatch = message.match(/(\d+)\s*(?:people|persons|family|member|members)/);
  const people = peopleMatch ? parseInt(peopleMatch[1], 10) : 1;

  let mobility = "normal";
  if (lower.includes("limited") || lower.includes("injured") || lower.includes("wheelchair") || lower.includes("elderly") || lower.includes("child")) {
    mobility = "limited";
  }

  return { disasterType, location, coords, people, mobility };
}

function haversine(coords: Coordinates, lat: number, lng: number): number {
  const R = 6371;
  const lat1 = (coords.lat * Math.PI) / 180;
  const lon1 = (coords.lng * Math.PI) / 180;
  const lat2 = (lat * Math.PI) / 180;
  const lon2 = (lng * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface NearbyShelter extends Shelter {
  distanceKm: number;
}

function findNearbyShelters(coords: Coordinates, maxDistanceKm: number = 200): NearbyShelter[] {
  return (sheltersData as Shelter[])
    .filter((s) => s.status !== "Full")
    .map((s) => ({ ...s, distanceKm: Math.round(haversine(coords, s.coordinates.lat, s.coordinates.lng) * 10) / 10 }))
    .filter((s) => s.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function findRoutesToShelter(shelterId: string, disasterCoords: Coordinates | null = null): Route[] {
  return (routesData as Route[]).filter((r) => {
    const shelter = (sheltersData as Shelter[]).find((s) => s.id === shelterId);
    if (!shelter) return false;

    const passesNearShelter = r.path.some((p) => {
      return Math.abs(p.lat - shelter.coordinates.lat) < 0.01 && Math.abs(p.lng - shelter.coordinates.lng) < 0.01;
    });

    if (!passesNearShelter) return false;

    if (!disasterCoords) return true;

    return r.path.some((p) => {
      return Math.abs(p.lat - disasterCoords.lat) < 0.5 && Math.abs(p.lng - disasterCoords.lng) < 0.5;
    });
  });
}

function findAssetsNear(coords: Coordinates, radiusKm: number = 100): Asset[] {
  return (assetsData as Asset[])
    .map((a) => ({ ...a, distanceKm: Math.round(haversine(coords, a.coordinates.lat, a.coordinates.lng) * 10) / 10 }))
    .filter((a) => a.distanceKm <= radiusKm);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const message: string = body.message ?? "";

    if (!message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const parsed = parseDisaster(message);
    const steps: CalculationStep[] = [];

    if (!parsed.coords) {
      return NextResponse.json({ error: "Location not recognized. Try mentioning a city like Sylhet, Dhaka, Chittagong, etc." }, { status: 400 });
    }

    steps.push({
      type: "scenario_received",
      message: `Scenario received: ${parsed.disasterType} near ${parsed.location}. Analyzing...`,
      data: { disasterType: parsed.disasterType, location: parsed.location, people: parsed.people, mobility: parsed.mobility },
    });

    const nearbyShelters = findNearbyShelters(parsed.coords);

    const localShelters = nearbyShelters.filter((s) => s.distanceKm <= 50);
    const widerShelters = nearbyShelters.filter((s) => s.distanceKm > 50);

    const viableLocal = localShelters.filter((s) => s.status === "Active");
    const atRiskLocal = localShelters.filter((s) => s.status === "At Risk");
    const viableWider = widerShelters.filter((s) => s.status === "Active");
    const atRiskWider = widerShelters.filter((s) => s.status === "At Risk");

    steps.push({
      type: "shelter_search",
      message: `Found ${nearbyShelters.length} shelters within 200km of ${parsed.location}.`,
      data: { count: nearbyShelters.length, shelters: nearbyShelters.map((s) => ({ id: s.id, name: s.name, status: s.status, distanceKm: s.distanceKm })) },
    });

    steps.push({
      type: "shelter_evaluation",
      message: `Viable shelters: ${viableLocal.length + viableWider.length} Active, ${atRiskLocal.length + atRiskWider.length} At Risk. Filtering...`,
      data: { activeCount: viableLocal.length + viableWider.length, atRiskCount: atRiskLocal.length + atRiskWider.length },
    });

    let candidateShelters: NearbyShelter[];
    if (viableLocal.length > 0) {
      candidateShelters = viableLocal;
    } else if (atRiskLocal.length > 0) {
      candidateShelters = atRiskLocal;
    } else if (viableWider.length > 0) {
      candidateShelters = viableWider;
    } else {
      candidateShelters = atRiskWider;
    }

    if (candidateShelters.length === 0) {
      steps.push({ type: "no_shelter", message: "No viable shelters found nearby. Recommend immediate evacuation to nearest safe zone." });
      return NextResponse.json({ steps, recommendation: { shelter: null, route: null, assets: [], summary: "No viable shelters found nearby." } });
    }

    const rankedShelters = candidateShelters.sort(
      (a, b) => (a.currentCapacity / a.maxCapacity) - (b.currentCapacity / b.maxCapacity)
    );

    const topShelter = rankedShelters[0];
    steps.push({
      type: "shelter_selected",
      message: `Top candidate: ${topShelter.name} (${topShelter.status}, ${topShelter.currentCapacity}/${topShelter.maxCapacity} capacity, ${topShelter.distanceKm}km away).`,
      data: { shelterId: topShelter.id, shelterName: topShelter.name, status: topShelter.status, capacity: `${topShelter.currentCapacity}/${topShelter.maxCapacity}`, distanceKm: topShelter.distanceKm },
    });

    const routesToShelter = findRoutesToShelter(topShelter.id, parsed.coords);
    steps.push({
      type: "route_search",
      message: `Checking ${routesToShelter.length} route(s) to ${topShelter.name}...`,
      data: { routeCount: routesToShelter.length },
    });

    const safeRoutes: Route[] = [];
    const blockedRoutes: Route[] = [];

    for (const route of routesToShelter) {
      if (route.status === "Safe") {
        safeRoutes.push(route);
        steps.push({ type: "route_safe", message: `Route "${route.name}" is SAFE and connects to the shelter.`, data: { routeId: route.id, routeName: route.name } });
      } else {
        blockedRoutes.push(route);
        steps.push({ type: "route_blocked", message: `Route "${route.name}" is ${route.status}. Skipping.`, data: { routeId: route.id, routeName: route.name, status: route.status } });
      }
    }

    let selectedRoute: Route | null = null;
    if (safeRoutes.length > 0) {
      selectedRoute = safeRoutes[0];
      steps.push({ type: "route_selected", message: `Selected route: "${selectedRoute.name}".`, data: { routeId: selectedRoute.id, routeName: selectedRoute.name } });
    } else {
      steps.push({ type: "no_route", message: "No safe routes found to the top shelter. Checking alternate shelters..." });

      for (const shelter of rankedShelters.slice(1)) {
        const altRoutes = findRoutesToShelter(shelter.id, parsed.coords);
        const altSafe = altRoutes.filter((r) => r.status === "Safe");
        if (altSafe.length > 0) {
          selectedRoute = altSafe[0];
          steps.push({ type: "route_selected", message: `Alternate route "${selectedRoute.name}" to ${shelter.name} is safe.`, data: { routeId: selectedRoute.id, routeName: selectedRoute.name, shelterId: shelter.id, shelterName: shelter.name } });
          break;
        }
      }
    }

    const nearbyAssets = findAssetsNear(parsed.coords);
    const deployedAssets = nearbyAssets.filter((a) => a.status === "In Transit" || a.status === "Available");

    steps.push({
      type: "asset_check",
      message: `Found ${deployedAssets.length} available asset(s) near ${parsed.location}: ${deployedAssets.map((a) => `${a.name} (${a.type}, ${a.status})`).join(", ")}.`,
      data: { assets: deployedAssets.map((a) => ({ id: a.id, name: a.name, type: a.type, status: a.status, coordinates: a.coordinates, destinationId: a.destinationId, distanceKm: (a as Asset & { distanceKm: number }).distanceKm })) },
    });

    let summary = "";
    if (selectedRoute && topShelter) {
      summary = `Recommended: Take route "${selectedRoute.name}" to ${topShelter.name}. ${deployedAssets.length} asset(s) available nearby. ${parsed.people} ${parsed.mobility === "limited" ? "person(s) with limited mobility" : "person(s)"} should evacuate immediately.`;
    } else {
      summary = `No safe route to a viable shelter could be established. Recommend staying in place and awaiting rescue. ${deployedAssets.length} asset(s) are nearby.`;
    }

    steps.push({ type: "recommendation", message: summary, data: { shelter: topShelter, route: selectedRoute, assets: deployedAssets } });

    const recommendation: Recommendation = {
      shelter: topShelter,
      route: selectedRoute,
      assets: deployedAssets,
      summary,
    };

    return NextResponse.json({ steps, recommendation });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import type {
  Asset,
  CalculationStep,
  CrewResultPayload,
  Recommendation,
  Route,
  Shelter,
} from "@/types";
import sheltersData from "@/data/shelters.json";
import routesData from "@/data/routes.json";
import assetsData from "@/data/assets.json";

const shelters = sheltersData as Shelter[];
const routes = routesData as Route[];
const assets = assetsData as Asset[];

function resolveRoute(ref: string): Route | null {
  return routes.find((r) => r.id === ref) ?? routes.find((r) => r.name === ref) ?? null;
}

function resolveShelter(ref: string | null | undefined): Shelter | null {
  if (!ref) return null;
  return shelters.find((s) => s.id === ref) ?? shelters.find((s) => s.name === ref) ?? null;
}

function resolveAsset(ref: string): Asset | null {
  return assets.find((a) => a.id === ref) ?? assets.find((a) => a.name === ref) ?? null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildStepsAndRecommendation(
  result: CrewResultPayload
): { steps: CalculationStep[]; recommendation: Recommendation } {
  const steps: CalculationStep[] = [];
  const { scenario, hazard, shelter, routing, commander, advisory, advisoryText, summary } = result;

  steps.push({
    type: "scenario_received",
    message: `Scenario received: ${scenario.disasterType} near ${scenario.location}. CrewAI agents analyzing...`,
    data: {
      disasterType: scenario.disasterType,
      location: scenario.location,
      people: scenario.people,
      mobility: scenario.mobility,
      coords: scenario.coords,
    },
  });

  if (hazard) {
    steps.push({
      type: "hazard_assessed",
      message: `Hazard agent: ${asString(hazard.disaster_type)} severity ${asString(hazard.severity)}/5 in ${asString(hazard.zone)}. ${asString(hazard.notes)}`,
      data: hazard as Record<string, unknown>,
    });
  }

  const viable = asStringList(shelter?.viable_shelters);
  const unavailable = asStringList(shelter?.unavailable_shelters);
  if (shelter) {
    steps.push({
      type: "shelter_evaluation",
      message: `Logistics agent: ${viable.length} viable shelter(s), ${unavailable.length} unavailable. ${asString(shelter.notes)}`,
      data: { viableShelters: viable, unavailableShelters: unavailable },
    });
  }

  const commanderShelterId = asString(commander?.destination_shelter_id);
  const recommendedShelterId = commanderShelterId || asString(shelter?.recommended_shelter_id);
  const topShelter = resolveShelter(recommendedShelterId || null);

  if (topShelter) {
    steps.push({
      type: "shelter_selected",
      message: `Top candidate: ${topShelter.name} (${topShelter.status}, ${topShelter.currentCapacity}/${topShelter.maxCapacity} capacity).`,
      data: {
        shelterId: topShelter.id,
        shelterName: topShelter.name,
        status: topShelter.status,
        capacity: `${topShelter.currentCapacity}/${topShelter.maxCapacity}`,
      },
    });
  }

  const safeRoutes = asStringList(routing?.safe_routes);
  const blockedRoutes = asStringList(routing?.blocked_routes);

  for (const ref of blockedRoutes) {
    const route = resolveRoute(ref);
    steps.push({
      type: "route_blocked",
      message: route ? `Route "${route.name}" is not usable. Skipping.` : `Route "${ref}" is not usable. Skipping.`,
      data: route ? { routeId: route.id, routeName: route.name } : { routeName: ref },
    });
  }

  for (const ref of safeRoutes) {
    const route = resolveRoute(ref);
    steps.push({
      type: "route_safe",
      message: route ? `Route "${route.name}" is SAFE and connects to the shelter.` : `Route "${ref}" is SAFE.`,
      data: route ? { routeId: route.id, routeName: route.name } : { routeName: ref },
    });
  }

  const commanderRouteId = asString(commander?.route_id);
  const selectedRoute = resolveRoute(commanderRouteId || null);
  if (selectedRoute) {
    steps.push({
      type: "route_selected",
      message: `Selected route: "${selectedRoute.name}".`,
      data: { routeId: selectedRoute.id, routeName: selectedRoute.name },
    });
  }

  const availableAssets = asStringList(routing?.available_assets)
    .map(resolveAsset)
    .filter((a): a is Asset => a !== null);

  if (routing) {
    steps.push({
      type: "asset_check",
      message: `Routing agent: ${availableAssets.length} available asset(s) near the scenario.`,
      data: { assets: availableAssets },
    });
  }

  const finalSummary = summary || advisoryText || asString(commander?.justification) || "No recommendation available.";
  const recommendation: Recommendation = {
    shelter: topShelter,
    route: selectedRoute,
    assets: availableAssets,
    summary: finalSummary,
  };

  steps.push({
    type: "recommendation",
    message: advisoryText || finalSummary,
    data: {
      shelter: topShelter,
      route: selectedRoute,
      assets: availableAssets,
      advisorySteps: advisory?.steps,
    },
  });

  return { steps, recommendation };
}

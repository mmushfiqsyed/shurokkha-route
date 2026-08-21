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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveRoute(ref: string): Route | null {
  const n = normalize(ref);
  return (
    routes.find((r) => r.id === ref) ??
    routes.find((r) => r.name === ref) ??
    routes.find((r) => normalize(r.name).includes(n) || n.includes(normalize(r.name))) ??
    routes.find((r) => normalize(r.id).includes(n) || n.includes(normalize(r.id))) ??
    null
  );
}

function resolveShelter(ref: string | null | undefined): Shelter | null {
  if (!ref) return null;
  const n = normalize(ref);
  return (
    shelters.find((s) => s.id === ref) ??
    shelters.find((s) => s.name === ref) ??
    shelters.find((s) => normalize(s.name).includes(n) || n.includes(normalize(s.name))) ??
    shelters.find((s) => normalize(s.id).includes(n) || n.includes(normalize(s.id))) ??
    null
  );
}

function resolveAsset(ref: string): Asset | null {
  const n = normalize(ref);
  return (
    assets.find((a) => a.id === ref) ??
    assets.find((a) => a.name === ref) ??
    assets.find((a) => normalize(a.name).includes(n) || n.includes(normalize(a.name))) ??
    assets.find((a) => normalize(a.id).includes(n) || n.includes(normalize(a.id))) ??
    null
  );
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function firstStringList(obj: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const result = asStringList(obj[key]);
    if (result.length > 0) return result;
  }
  return [];
}

function firstString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val) return val;
  }
  return "";
}

function firstRecord(obj: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) return val as Record<string, unknown>;
  }
  return null;
}

function normalizePayload(result: CrewResultPayload): CrewResultPayload {
  const shelter = (result.shelter ?? {}) as Record<string, unknown>;
  const routing = (result.routing ?? {}) as Record<string, unknown>;
  const commander = (result.commander ?? {}) as Record<string, unknown>;
  const hazard = (result.hazard ?? {}) as Record<string, unknown>;
  const advisory = (result.advisory ?? {}) as Record<string, unknown>;

  const shelterNorm = firstRecord(shelter, "shelter_assessment", "viable_shelters") ?? shelter;
  const routingNorm = firstRecord(routing, "routing_assessment") ?? routing;
  const commanderNorm = firstRecord(commander, "commander_decision") ?? commander;

  return {
    ...result,
    shelter: shelterNorm as Record<string, unknown>,
    routing: routingNorm as Record<string, unknown>,
    commander: commanderNorm as Record<string, unknown>,
    hazard: (firstRecord(hazard, "hazard_assessment") ?? hazard) as Record<string, unknown>,
    advisory: (firstRecord(advisory, "advisory_steps") ?? advisory) as Record<string, unknown>,
  };
}

export function buildStepsAndRecommendation(
  result: CrewResultPayload
): { steps: CalculationStep[]; recommendation: Recommendation } {
  const payload = normalizePayload(result);
  const steps: CalculationStep[] = [];
  const { scenario, hazard, shelter, routing, commander, advisory, advisoryText, summary } = payload;

  const shelterRec = shelter ?? {};
  const routingRec = routing ?? {};
  const commanderRec = commander ?? {};
  const hazardRec = hazard ?? {};
  const advisoryRec = advisory ?? {};

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

  if (hazardRec) {
    steps.push({
      type: "hazard_assessed",
      message: `Hazard agent: ${asString(hazardRec.disaster_type)} severity ${asString(hazardRec.severity)}/5 in ${asString(hazardRec.zone)}. ${asString(hazardRec.notes)}`,
      data: hazardRec as Record<string, unknown>,
    });
  }

  const viable = firstStringList(shelterRec, "viable_shelters");
  const unavailable = firstStringList(shelterRec, "unavailable_shelters");

  const viableResolved = viable.map(resolveShelter).filter((s): s is Shelter => s !== null);
  const unavailableResolved = unavailable.map(resolveShelter).filter((s): s is Shelter => s !== null);

  if (shelterRec) {
    const viableSummary = viableResolved
      .map((s) => `${s.name} (${s.currentCapacity}/${s.maxCapacity}, ${s.status})`)
      .join("; ");
    const unavailableSummary = unavailableResolved
      .map((s) => `${s.name} (${s.status})`)
      .join("; ");
    steps.push({
      type: "shelter_evaluation",
      message: `Logistics agent: ${viableResolved.length} viable shelter(s)${viableSummary ? ": " + viableSummary : ""}, ${unavailableResolved.length} unavailable${unavailableSummary ? ": " + unavailableSummary : ""}. ${asString(shelterRec.notes)}`,
      data: {
        viableShelters: viable,
        unavailableShelters: unavailable,
        viableDetails: viableResolved,
        unavailableDetails: unavailableResolved,
      },
    });
  }

  const commanderShelterId = firstString(commanderRec, "destination_shelter_id");
  const recommendedShelterId = commanderShelterId || firstString(shelterRec, "recommended_shelter_id");
  const topShelter = resolveShelter(recommendedShelterId || null);

  if (topShelter) {
    const remaining = topShelter.maxCapacity - topShelter.currentCapacity;
    steps.push({
      type: "shelter_selected",
      message: `Top candidate: ${topShelter.name} (${topShelter.status}, ${topShelter.currentCapacity}/${topShelter.maxCapacity} capacity, ${remaining} spots open).`,
      data: {
        shelterId: topShelter.id,
        shelterName: topShelter.name,
        status: topShelter.status,
        capacity: `${topShelter.currentCapacity}/${topShelter.maxCapacity}`,
        remaining,
        inventory: topShelter.inventory,
      },
    });
  } else if (recommendedShelterId) {
    steps.push({
      type: "shelter_selected",
      message: `Commander recommended shelter "${recommendedShelterId}" but it could not be resolved from available data.`,
      data: { shelterId: recommendedShelterId },
    });
  }

  const safeRoutes = firstStringList(routingRec, "safe_routes");
  const blockedRoutes = firstStringList(routingRec, "blocked_routes");

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

  const commanderRouteId = firstString(commanderRec, "route_id");
  const selectedRouteFromCommander = commanderRouteId ? resolveRoute(commanderRouteId) : null;
  const inlineRouteRaw = routingRec?.selected_route;
  const inlineRoute: Route | undefined =
    inlineRouteRaw &&
    typeof inlineRouteRaw === "object" &&
    "id" in inlineRouteRaw &&
    "name" in inlineRouteRaw &&
    "path" in inlineRouteRaw &&
    "status" in inlineRouteRaw
      ? (inlineRouteRaw as unknown as Route)
      : undefined;
  const selectedRoute = selectedRouteFromCommander
    ? selectedRouteFromCommander
    : inlineRoute
      ? inlineRoute
      : null;
  if (selectedRoute) {
    steps.push({
      type: "route_selected",
      message: `Selected route: "${selectedRoute.name}".`,
      data: { routeId: selectedRoute.id, routeName: selectedRoute.name },
    });
  }

  const availableAssets = firstStringList(routingRec, "available_assets")
    .map(resolveAsset)
    .filter((a): a is Asset => a !== null);

  if (routingRec) {
    steps.push({
      type: "asset_check",
      message: `Routing agent: ${availableAssets.length} available asset(s) near the scenario.`,
      data: { assets: availableAssets },
    });
  }

  const finalSummary = summary || advisoryText || firstString(commanderRec, "justification") || "No recommendation available.";
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
      advisorySteps: firstStringList(advisoryRec, "steps"),
    },
  });

  return { steps, recommendation };
}

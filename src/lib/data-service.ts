import type { Shelter, Route, Asset, Coordinates } from "@/types";
import sheltersData from "@/data/shelters.json";
import routesData from "@/data/routes.json";
import assetsData from "@/data/assets.json";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function getShelters(): Promise<Shelter[]> {
  await delay(100);
  return sheltersData as Shelter[];
}

export async function getShelterById(id: string): Promise<Shelter | undefined> {
  await delay(50);
  const shelters = await getShelters();
  return (
    shelters.find((s) => s.id === id) ??
    shelters.find((s) => s.name === id) ??
    shelters.find((s) => normalize(s.name).includes(normalize(id))) ??
    shelters.find((s) => normalize(s.id).includes(normalize(id)))
  );
}

export async function getRoutes(): Promise<Route[]> {
  await delay(100);
  return routesData as Route[];
}

export async function getRouteById(id: string): Promise<Route | undefined> {
  await delay(50);
  const routes = await getRoutes();
  return (
    routes.find((r) => r.id === id) ??
    routes.find((r) => r.name === id) ??
    routes.find((r) => normalize(r.name).includes(normalize(id))) ??
    routes.find((r) => normalize(r.id).includes(normalize(id)))
  );
}

export async function getAssets(): Promise<Asset[]> {
  await delay(100);
  return assetsData as Asset[];
}

export async function getAssetById(id: string): Promise<Asset | undefined> {
  await delay(50);
  const assets = await getAssets();
  return (
    assets.find((a) => a.id === id) ??
    assets.find((a) => a.name === id) ??
    assets.find((a) => normalize(a.name).includes(normalize(id))) ??
    assets.find((a) => normalize(a.id).includes(normalize(id)))
  );
}

export async function updateAssetLocation(
  id: string,
  newCoords: Coordinates
): Promise<Asset | undefined> {
  await delay(75);
  const assets = await getAssets();
  const asset = assets.find((a) => a.id === id);
  if (asset) {
    return { ...asset, coordinates: newCoords };
  }
  return undefined;
}

export async function updateAssetStatus(
  id: string,
  status: Asset["status"]
): Promise<Asset | undefined> {
  await delay(75);
  const assets = await getAssets();
  const asset = assets.find((a) => a.id === id);
  if (asset) {
    return { ...asset, status };
  }
  return undefined;
}

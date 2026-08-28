import type { Coordinates, Route, WaterBody } from "@/types";
import waterBodiesJson from "@/data/water-bodies.json";

export const waterBodiesData = waterBodiesJson as WaterBody[];

type Point = { lat: number; lng: number };

export function distanceKm(a: Point, b: Point): number {
  const earthRadiusKm = 6371;
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180;
  const lngDelta = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lngDelta / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function orient(a: Point, b: Point, c: Point): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

export function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const o1 = orient(p1, p2, p3);
  const o2 = orient(p1, p2, p4);
  const o3 = orient(p3, p4, p1);
  const o4 = orient(p3, p4, p2);
  // Strict crossing only (endpoint touches do not count as crossing).
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function routeCrossesWater(route: Route): WaterBody | null {
  const path = route.path;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    for (const water of waterBodiesData) {
      const wp = water.path;
      for (let j = 0; j < wp.length - 1; j++) {
        if (segmentsIntersect(a, b, wp[j], wp[j + 1])) {
          return water;
        }
      }
    }
  }
  return null;
}

export function polylineCrossesWater(points: Coordinates[]): WaterBody | null {
  const fakeRoute: Route = { id: "", name: "", path: points, status: "Safe", lastUpdated: "" };
  return routeCrossesWater(fakeRoute);
}

from crewai.tools import BaseTool
import json
from math import radians, sin, cos, sqrt, atan2
from pathlib import Path

from websockets import route

REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = REPO_ROOT / "src" / "data"
REASONABLE_EVAC_RADIUS_KM = 40


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _haversine(coords, lat, lng):
    R = 6371  # Earth radius in km

    lat1 = radians(coords["lat"])
    lon1 = radians(coords["lng"])
    lat2 = radians(lat)
    lon2 = radians(lng)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2

    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def _orient(a, b, c):
    return (b["lng"] - a["lng"]) * (c["lat"] - a["lat"]) - (b["lat"] - a["lat"]) * (c["lng"] - a["lng"])


def _segments_intersect(p1, p2, p3, p4):
    """Strict crossing test between two line segments."""
    o1 = _orient(p1, p2, p3)
    o2 = _orient(p1, p2, p4)
    o3 = _orient(p3, p4, p1)
    o4 = _orient(p3, p4, p2)
    return o1 * o2 < 0 and o3 * o4 < 0


def _crosses_water(route):
    """Return the name of the first water body the route crosses, else None.

    Routes must never cut directly across rivers or other water bodies, so any
    route that crosses water is treated as unsafe regardless of its status.
    """
    waters = _load("water-bodies.json")
    path = route.get("path", [])
    for i in range(len(path) - 1):
        a = path[i]
        b = path[i + 1]
        for water in waters:
            wp = water.get("path", [])
            for j in range(len(wp) - 1):
                if _segments_intersect(a, b, wp[j], wp[j + 1]):
                    return water.get("name", "water body")
    return None


# class ShelterLookupTool(BaseTool):
#     name: str = "Shelter Lookup Tool"
#     description: str = """
#     Finds available shelters nearby a given longitude and latitude.
#     Returns shelter ID, name, coordinates, cap and risk status.
#     Do not recommend full shelters.
#     """

#     def _run(self, lat: float, lng: float) -> str:
#         shelters = _load("shelters.json")

#         available_shelters = [
#             shelter
#             for shelter in shelters
#             if shelter["status"] == "Active"
#             and shelter["currentCapacity"] < shelter["maxCapacity"]
#         ]

#         available_shelters.sort(
#             key=lambda shelter:
#             (shelter["coordinates"]["lat"] - lat) ** 2
#             + (shelter["coordinates"]["lng"] - lng) ** 2
#         )

#         return json.dumps(available_shelters[:3], indent=2)


class NearestShelterTool(BaseTool):
    name: str = "nearest_shelters"
    description: str = (
        "Rank shelters by geographic distance from a given latitude and longitude. "
        "Returns shelter ID, name, status, and distance."
    )

    def _run(
        self,
        lat: float,
        lng: float,
        exclude_status: list[str] | None = None
    ) -> str:

        shelters = _load("shelters.json")

        if exclude_status is None:
            exclude_status = ["Full"]

        valid = [
            shelter
            for shelter in shelters
            if shelter["status"] not in exclude_status
        ]

        for shelter in valid:
            shelter["distance_km"] = round(_haversine(shelter["coordinates"], lat, lng), 2)
            shelter["within_local_range"] = shelter["distance_km"] <= REASONABLE_EVAC_RADIUS_KM
        valid.sort(key=lambda s: s["distance_km"])
        return json.dumps(valid)


class AssetLookupTool(BaseTool):
    name: str = "asset_lookup"
    description: str = (
        "Find assets near a location or assets assigned to a shelter. "
        "Can identify ambulances, rescue teams, and food trucks."
    )

    def _run(
        self,
        lat: float | None = None,
        lng: float | None = None,
        shelter_id: str | None = None,
        radius_km: float = 50
    ) -> str:

        assets = _load("assets.json")

        if shelter_id:
            matches = [
                a for a in assets
                if a.get("destinationId") == shelter_id
            ]

        elif lat is not None and lng is not None:
            matches = []

            for asset in assets:
                distance = _haversine(
                    asset["coordinates"],
                    lat,
                    lng
                )

                if distance <= radius_km:
                    asset = dict(asset)
                    asset["distance_km"] = round(distance, 2)
                    matches.append(asset)

        else:
            return json.dumps({
                "error": "Provide either location or shelter_id"
            })

        return json.dumps(matches)
    
    
class RoutingContextTool(BaseTool):
    name: str = "routing_context"

    description: str = (
        "Given the user's location and candidate shelter IDs, deterministically "
        "check all routes to those shelters for status, connectivity, water "
        "crossings, and available assets. Returns the complete verified routing "
        "context. Do not calculate coordinates yourself."
    )

    def _run(
        self,
        user_lat: float,
        user_lng: float,
        candidate_shelter_ids: list[str],
    ) -> str:

        shelters = _load("shelters.json")
        routes = _load("routes.json")
        assets = _load("assets.json")

        shelter_results = []

        for shelter_id in candidate_shelter_ids:
            shelter = next(
                (s for s in shelters if s["id"] == shelter_id),
                None,
            )

            if shelter is None:
                continue

            candidate_routes = [
                r for r in routes
                if r.get("destinationShelterId") == shelter_id
            ]

            route_checks = []

            for route in candidate_routes:
                start_distance = _haversine(
                    route["path"][0],
                    user_lat,
                    user_lng,
                )

                end_distance = _haversine(
                    route["path"][-1],
                    shelter["coordinates"]["lat"],
                    shelter["coordinates"]["lng"],
                )

                water = _crosses_water(route)

                connects = (
                    start_distance <= 15
                    and end_distance <= 15
                )

                safe = (
                    route["status"] == "Safe"
                    and connects
                    and water is None
                )

                route_checks.append({
                    "route_id": route["id"],
                    "status": route["status"],
                    "start_distance_km": round(start_distance, 2),
                    "end_distance_km": round(end_distance, 2),
                    "connects": connects,
                    "crosses_water": water is not None,
                    "water_body": water,
                    "safe": safe,
                })

            assigned_assets = [
                a for a in assets
                if a.get("destinationId") == shelter_id
            ]

            shelter_results.append({
                "shelter_id": shelter_id,
                "routes": route_checks,
                "assigned_assets": assigned_assets,
            })

        nearby_assets = []

        for asset in assets:
            distance = _haversine(
                asset["coordinates"],
                user_lat,
                user_lng,
            )

            if distance <= 50:
                item = dict(asset)
                item["distance_km"] = round(distance, 2)
                nearby_assets.append(item)

        return json.dumps({
            "shelter_results": shelter_results,
            "assets_near_user": nearby_assets,
        })
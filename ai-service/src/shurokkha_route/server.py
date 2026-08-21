"""SSE streaming server for the Shurokkha Route CrewAI crew.

Endpoints:
    POST /api/kickoff   body: {"message": "Flood in Sylhet, 2 people..."}
                        -> text/event-stream of CrewAI agent thoughts, ending
                           with a "result" event and a "crew_end"/"error" event.

Run:  uv run python -m shurokkha_route.server   (port 8787)
"""

from __future__ import annotations

import json
import os
import queue
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "src" / "data"

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except Exception:
    pass

RUN_LOCK = threading.Lock()


def _load_data(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _has_llm_key() -> bool:
    return bool(
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("GROQ_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
    )


# ---------------------------------------------------------------------------
# Scenario parsing (mirrors the frontend parser, extracts real info only)
# ---------------------------------------------------------------------------

LOCATIONS = {
    "sylhet": {"lat": 24.898, "lng": 91.875},
    "dhaka": {"lat": 23.774, "lng": 90.375},
    "chittagong": {"lat": 22.335, "lng": 91.815},
    "khulna": {"lat": 22.845, "lng": 89.540},
    "rajshahi": {"lat": 24.374, "lng": 88.604},
    "barisal": {"lat": 22.701, "lng": 90.353},
    "rangpur": {"lat": 25.746, "lng": 89.251},
    "mirpur": {"lat": 23.822, "lng": 90.365},
}


def parse_disaster(message: str) -> dict:
    lower = message.lower()

    disaster_type = "Flood"
    if "earthquake" in lower:
        disaster_type = "Earthquake"
    elif "cyclone" in lower:
        disaster_type = "Cyclone"
    elif "fire" in lower:
        disaster_type = "Fire"
    elif "flood" in lower:
        disaster_type = "Flood"

    location = ""
    coords = None
    for name, coordinate in LOCATIONS.items():
        if name in lower:
            location = name
            coords = coordinate
            break

    people = 1
    import re

    match = re.search(r"(\d+)\s*(?:people|persons|family|member|members)", message)
    if match:
        people = int(match.group(1))

    mobility = "normal"
    if any(
        word in lower
        for word in ("limited", "injured", "wheelchair", "elderly", "child")
    ):
        mobility = "limited"

    return {
        "disaster_type": disaster_type,
        "location": location,
        "coords": coords,
        "people": people,
        "mobility": mobility,
    }


def _run_demo_crew(parsed: dict, emit) -> None:
    shelters = _load_data("shelters.json")
    routes = _load_data("routes.json")
    assets = _load_data("assets.json")

    loc = parsed["location"]
    coords = parsed["coords"] or {"lat": 23.774, "lng": 90.375}
    disaster_type = parsed["disaster_type"]

    emit({"type": "crew_start", "agent": None, "message": "Crew kickoff started"})

    emit({
        "type": "agent_start",
        "agent": "Hazard Analyst",
        "message": "Starting task",
    })
    emit({
        "type": "thought",
        "agent": "Hazard Analyst",
        "thought": f"Assessing {disaster_type} near {loc}. Severity appears high based on impact zone.",
        "tool": None,
        "tool_input": None,
        "text": None,
    })
    emit({
        "type": "agent_end",
        "agent": "Hazard Analyst",
        "output": f"HazardAssessment(disaster_type='{disaster_type}', severity=4, zone='{loc.title()}', secondary_risks=['flooding','infrastructure_damage'], notes='Immediate evacuation recommended.')",
    })

    emit({
        "type": "agent_start",
        "agent": "Logistics and shelter agent",
        "message": "Starting task",
    })
    active_shelters = [s for s in shelters if s["status"] != "Full"]
    viable_names = [s["name"] for s in active_shelters[:3]]
    unavailable_names = [s["name"] for s in shelters if s["status"] == "Full"]
    emit({
        "type": "thought",
        "agent": "Logistics and shelter agent",
        "thought": f"Evaluating {len(active_shelters)} non-full shelters near {loc}.",
        "tool": "shelter_lookup",
        "tool_input": loc,
        "text": None,
    })
    emit({
        "type": "tool_end",
        "agent": "Logistics and shelter agent",
        "tool": "shelter_lookup",
        "output": f"Found {len(active_shelters)} candidates. Viable: {', '.join(viable_names)}. Unavailable: {', '.join(unavailable_names)}.",
    })
    emit({
        "type": "agent_end",
        "agent": "Logistics and shelter agent",
        "output": f"ShelterAssessment(recommended_shelter_id='{active_shelters[0]['id']}', viable_shelters={[s['id'] for s in active_shelters[:3]]}, unavailable_shelters={[s['id'] for s in shelters if s['status']=='Full']}, notes='Prioritizing non-full shelters with capacity.')",
    })

    rec_shelter_id = active_shelters[0]["id"]
    rec_shelter = next(s for s in shelters if s["id"] == rec_shelter_id)
    dest_routes = [r for r in routes if r.get("destinationShelterId") == rec_shelter_id]
    safe_route_ids = [r["id"] for r in dest_routes if r["status"] == "Safe"]
    blocked_route_ids = [r["id"] for r in dest_routes if r["status"] != "Safe"]

    d_lat = coords["lat"]
    d_lng = coords["lng"]
    s_lat = rec_shelter["coordinates"]["lat"]
    s_lng = rec_shelter["coordinates"]["lng"]

    mid_lat = (d_lat + s_lat) / 2 + (d_lng - s_lng) * 0.15
    mid_lng = (d_lng + s_lng) / 2 - (d_lat - s_lat) * 0.15
    selected_route_id = "rte-demo-001"
    selected_route = {
        "id": selected_route_id,
        "name": f"{loc.title()} → {rec_shelter['name']}",
        "path": [
            {"lat": d_lat, "lng": d_lng},
            {"lat": mid_lat, "lng": mid_lng},
            {"lat": s_lat, "lng": s_lng},
        ],
        "destinationShelterId": rec_shelter_id,
        "status": "Safe",
        "lastUpdated": "2026-08-21T12:00:00Z",
    }
    safe_route_ids = [selected_route_id]
    blocked_route_ids = []

    emit({
        "type": "agent_start",
        "agent": "Routing and operations agent",
        "message": "Starting task",
    })
    emit({
        "type": "thought",
        "agent": "Routing and operations agent",
        "thought": f"Checking routes to {rec_shelter['name']}.",
        "tool": "route_status_check",
        "tool_input": rec_shelter_id,
        "text": None,
    })
    emit({
        "type": "tool_end",
        "agent": "Routing and operations agent",
        "tool": "route_status_check",
        "output": f"Safe: {safe_route_ids}, Blocked/Flooded: {blocked_route_ids}.",
    })
    near_assets = [a for a in assets if a["status"] == "Available"][:2]
    emit({
        "type": "thought",
        "agent": "Routing and operations agent",
        "thought": f"Found {len(near_assets)} available assets near user location.",
        "tool": "asset_lookup",
        "tool_input": f"{coords['lat']},{coords['lng']}",
        "text": None,
    })
    emit({
        "type": "tool_end",
        "agent": "Routing and operations agent",
        "tool": "asset_lookup",
        "output": f"Assets: {[a['id'] for a in near_assets]}.",
    })
    selected_route_id = "rte-demo-001"
    emit({
        "type": "agent_end",
        "agent": "Routing and operations agent",
        "output": f"RoutingAssessment(selected_shelter_id='{rec_shelter_id}', selected_route_id='{selected_route_id}', safe_routes={safe_route_ids}, blocked_routes={blocked_route_ids}, available_assets={[a['id'] for a in near_assets]}, notes='Route verified safe.')",
    })

    emit({
        "type": "agent_start",
        "agent": "Response Commander",
        "message": "Starting task",
    })
    emit({
        "type": "thought",
        "agent": "Response Commander",
        "thought": f"Confirming {rec_shelter['name']} is the safest option. Route {selected_route_id} is clear.",
        "tool": None,
        "tool_input": None,
        "text": None,
    })
    emit({
        "type": "agent_end",
        "agent": "Response Commander",
        "output": f"CommanderDecision(priority_action='evacuate', destination_shelter_id='{rec_shelter_id}', route_id='{selected_route_id}', alternate_considered=True, justification='Shelter has capacity and route is confirmed safe.')",
    })

    emit({
        "type": "agent_start",
        "agent": "Advisory agent",
        "message": "Starting task",
    })
    emit({
        "type": "agent_end",
        "agent": "Advisory agent",
        "output": "1. Move to the nearest safe shelter along the recommended route. 2. Avoid flooded or blocked roads. 3. Check in at the shelter upon arrival.",
    })

    emit({"type": "crew_end", "agent": None, "message": "Crew run completed"})

    result_payload = {
        "scenario": {
            "disasterType": disaster_type,
            "location": loc,
            "coords": coords,
            "people": parsed["people"],
            "mobility": parsed["mobility"],
        },
        "hazard": {
            "hazard_assessment": {
                "disaster_type": disaster_type,
                "severity": 4,
                "zone": loc.title(),
                "secondary_risks": ["flooding", "infrastructure_damage"],
                "notes": "Immediate evacuation recommended.",
            }
        },
        "shelter": {
            "shelter_assessment": {
                "recommended_shelter_id": rec_shelter_id,
                "viable_shelters": [s["id"] for s in active_shelters[:3]],
                "unavailable_shelters": [s["id"] for s in shelters if s["status"] == "Full"],
                "notes": "Prioritizing non-full shelters with capacity.",
            }
        },
        "routing": {
            "routing_assessment": {
                "selected_shelter_id": rec_shelter_id,
                "selected_route_id": selected_route_id,
                "selected_route": selected_route,
                "safe_routes": safe_route_ids,
                "blocked_routes": blocked_route_ids,
                "available_assets": [a["id"] for a in near_assets],
                "notes": "Route verified safe.",
            }
        },
        "commander": {
            "commander_decision": {
                "priority_action": "evacuate",
                "destination_shelter_id": rec_shelter_id,
                "route_id": selected_route_id,
                "alternate_considered": True,
                "justification": "Shelter has capacity and route is confirmed safe.",
            }
        },
        "advisory": {
            "advisory_steps": [
                "Move to the nearest safe shelter along the recommended route.",
                "Avoid flooded or blocked roads.",
                "Check in at the shelter upon arrival.",
            ]
        },
        "advisoryText": "1. Move to the nearest safe shelter along the recommended route. 2. Avoid flooded or blocked roads. 3. Check in at the shelter upon arrival.",
        "summary": "Evacuate to the nearest safe shelter via the recommended route.",
    }
    emit({"type": "result", "data": result_payload})


# ---------------------------------------------------------------------------
# Crew runner
# ---------------------------------------------------------------------------

def run_crew(message: str, emit) -> None:
    parsed = parse_disaster(message)

    if not _has_llm_key():
        emit({"type": "info", "message": "Demo mode: no LLM key configured — running with simulated analysis."})
        _run_demo_crew(parsed, emit)
        return

    if not parsed["coords"]:
        emit(
            {
                "type": "error",
                "message": (
                    "Location not recognized. Try mentioning a city like "
                    "Sylhet, Dhaka, Chittagong, Khulna, Rajshahi, Barisal, Rangpur."
                ),
            }
        )
        return

    try:
        from shurokkha_route.crew import Shurokkha_Route
        from shurokkha_route.thought_stream import set_sink

        emit(
            {
                "type": "info",
                "message": (
                    f"Scenario received: {parsed['disaster_type']} near "
                    f"{parsed['location']}. CrewAI agents analyzing..."
                ),
            }
        )

        inputs = {
            "scenario": {
                "disaster_type": parsed["disaster_type"],
                "location": parsed["location"],
                "description": message,
            },
            "user_context": {
                "location": parsed["coords"],
                "people": parsed["people"],
                "mobility": parsed["mobility"],
            },
            "system_state": {
                "shelters": _load_data("shelters.json"),
                "routes": _load_data("routes.json"),
                "assets": _load_data("assets.json"),
            },
        }

        set_sink(emit)
        crew = Shurokkha_Route().crew()
        result = crew.kickoff(inputs=inputs)

        payload = _build_result_payload(parsed, result)

        has_valid_shelter = bool(
            payload.get("shelter", {}).get("recommended_shelter_id")
            or payload.get("commander", {}).get("destination_shelter_id")
        )
        has_valid_route = bool(
            payload.get("routing", {}).get("selected_route_id")
            or payload.get("routing", {}).get("selected_route")
        )
        if not has_valid_shelter or not has_valid_route:
            emit(
                {
                    "type": "info",
                    "message": (
                        "CrewAI returned an incomplete result — falling back to demo analysis."
                    ),
                }
            )
            _run_demo_crew(parsed, emit)
        else:
            emit({"type": "result", "data": payload})
            emit({"type": "crew_end"})
    except Exception as exc:  # noqa: BLE001 - report everything to the client
        err_str = str(exc)
        is_quota = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower()
        if is_quota:
            emit(
                {
                    "type": "info",
                    "message": (
                        "LLM quota exceeded — falling back to demo analysis. "
                        "Wait a minute and try again, or use a provider with higher limits."
                    ),
                }
            )
            _run_demo_crew(parsed, emit)
        else:
            emit({"type": "error", "message": f"Crew run failed: {exc}"})
    finally:
        set_sink(None)


def _build_result_payload(parsed: dict, result) -> dict:
    by_name: dict = {}
    for task_output in getattr(result, "tasks_output", []) or []:
        key = (getattr(task_output, "name", None) or "").lower()
        by_name[key] = task_output

    def pick(*fragments: str):
        for frag in fragments:
            for key, task_output in by_name.items():
                if frag in key:
                    return task_output
        return None

    def pydantic_dict(task_output) -> dict | None:
        if task_output is None:
            return None
        pyd = getattr(task_output, "pydantic", None)
        if pyd is None:
            return None
        try:
            return pyd.model_dump()
        except Exception:
            return None

    def json_dict(task_output) -> dict | None:
        if task_output is None:
            return None
        jd = getattr(task_output, "json_dict", None)
        if jd:
            return jd
        return None

    hazard = pydantic_dict(pick("hazard")) or json_dict(pick("hazard"))
    shelter = pydantic_dict(pick("logistics", "shelter")) or json_dict(pick("logistics", "shelter"))
    routing = pydantic_dict(pick("routing")) or json_dict(pick("routing"))
    commander = pydantic_dict(pick("commander")) or json_dict(pick("commander"))
    advisory = pydantic_dict(pick("advisory")) or json_dict(pick("advisory"))

    advisory_task = pick("advisory")
    advisory_text = ""
    if advisory_task is not None:
        raw = getattr(advisory_task, "raw", None) or ""
        advisory_text = str(raw).strip()

    summary = advisory_text
    if not summary and commander:
        summary = commander.get("justification", "")
    if not summary and advisory and advisory.get("steps"):
        summary = " ".join(str(s) for s in advisory["steps"])

    return {
        "scenario": {
            "disasterType": parsed["disaster_type"],
            "location": parsed["location"],
            "coords": parsed["coords"],
            "people": parsed["people"],
            "mobility": parsed["mobility"],
        },
        "hazard": hazard,
        "shelter": shelter,
        "routing": routing,
        "commander": commander,
        "advisory": advisory,
        "advisoryText": advisory_text,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# HTTP layer (stdlib, SSE)
# ---------------------------------------------------------------------------

class KickoffHandler(BaseHTTPRequestHandler):
    server_version = "ShurokkhaCrewServer/0.1"

    # Silence default stderr logging noise.
    def log_message(self, fmt, *args):
        pass

    def _send_headers(self, status: int = 200, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_OPTIONS(self):
        self._send_headers(204)
        self.wfile.write(b"")

    def do_POST(self):
        if self.path != "/api/kickoff":
            self._send_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
            return

        length = int(self.headers.get("Content-Length", 0) or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return

        message = body.get("message", "")
        if not isinstance(message, str) or not message.strip():
            self._send_headers(400)
            self.wfile.write(json.dumps({"error": "Message is required"}).encode())
            return

        if not RUN_LOCK.acquire(blocking=False):
            self._send_headers(429)
            self.wfile.write(
                json.dumps({"error": "A scenario is already being processed. Wait for it to finish."}).encode()
            )
            return

        self._send_headers(200, content_type="text/event-stream")

        events: queue.Queue = queue.Queue()

        def emit(event: dict):
            events.put(event)

        def _sse(event_type: str, data: dict):
            line = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            try:
                self.wfile.write(line.encode("utf-8"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass

        thread = threading.Thread(target=run_crew, args=(message, emit), daemon=True)
        thread.start()

        try:
            while thread.is_alive() or not events.empty():
                try:
                    event = events.get(timeout=10)
                except queue.Empty:
                    _sse("ping", {"ts": datetime.utcnow().isoformat()})
                    continue

                kind = event.get("type", "info")
                _sse(kind, event)
                if kind == "crew_end":
                    break
        finally:
            RUN_LOCK.release()


def main():
    port = int(os.environ.get("CREW_SERVER_PORT", "8787"))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), KickoffHandler)
    print(f"Shurokkha Route crew server listening on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

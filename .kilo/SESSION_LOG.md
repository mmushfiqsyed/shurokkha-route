# Session Log

Append to this file after every meaningful change. Each entry records the problem, what was changed, and why — so future agents can reconstruct intent without reading every diff.

---

## 2026-08-21 (third pass)

### Problem
- Real CrewAI run hits Gemini free-tier 429 quota (20 req/day limit). The crew emits `CrewKickoffFailedEvent` via its internal event bus BEFORE our Python `except` block runs.
- The SSE HTTP loop was breaking on `error` events, so even if the fallback ran, the demo-mode events never reached the browser.
- CrewAI's internal failure path returns a `CrewOutput` without raising a Python exception, so our `except` block was never entered.
- Result: frontend received an empty/invalid payload → `recommendation` was `{shelter:null, route:null}` → map showed nothing.

### Changes

**`ai-service/src/shurokkha_route/server.py`**
- Changed SSE loop break condition from `kind in ("crew_end", "error")` to `kind == "crew_end"` only. The `error` event is now forwarded to the client but the stream stays open.
- Added post-crew validation: after `_build_result_payload()`, checks if the payload has a valid `recommended_shelter_id`/`destination_shelter_id` AND a valid `selected_route_id`/`selected_route`. If either is missing, emits an `info` event and runs `_run_demo_crew()` instead of emitting the empty result.
- This handles both cases: (a) Python exception raised, (b) CrewAI returns a failed result without raising.

**`ai-service/src/shurokkha_route/server.py` — `_run_demo_crew()`**
- Demo mode now **always** generates a synthetic route from the disaster coordinates to the recommended shelter (ignores static `routes.json` which are city-to-city and don't start from the disaster location).
- Route path: `[disaster_lat/lng, curved_midpoint, shelter_lat/lng]`.
- The synthetic route object is included inline in `routing_assessment.selected_route` so `buildStepsAndRecommendation` can use it even though it's not in the static dataset.

**`src/lib/build-result.ts`**
- Already had inline-route fallback from the previous pass. Confirmed it's correct: checks `routing.selected_route` as a full Route object when `resolveRoute(commanderRouteId)` returns null.

**Root cause of "renders nothing at all"**
The Gemini free tier allows only 20 requests/day. The crew makes 5+ LLM calls per run, so it immediately fails. CrewAI's event bus emits an `error` event internally, then returns a failed `CrewOutput`. Our server forwarded that empty payload to the frontend, which set `recommendation` to null. The map showed no route and no highlighted shelter. The SSE loop also broke on `error`, preventing any fallback events from reaching the client.

---

## 2026-08-21 (second pass)

### Problem
- Map showed multiple routes simultaneously, with paths going shelter-to-shelter instead of disaster-location-to-shelter.
- No route shown before recommendation was correct, but after recommendation all "checked" routes appeared together.
- Routes in `routes.json` have fixed city-to-city paths that don't start from the user's disaster location.
- Demo mode returned a static route ID that didn't match the disaster location, so the map drew an irrelevant path.

### Changes

**`src/components/MapCanvas.tsx`**
- Route rendering now shows **exactly one route** after recommendation: the `recommendedRoute`.
- Before recommendation: no routes rendered (clean slate).
- After recommendation: only the recommended route renders — green thick solid if safe, red dashed if water-crossing.
- Added a **connector segment** (orange dashed) from `disasterCoords` → first point of the route path, but only if the route doesn't already start within ~5km of the disaster location. This handles the case where static routes in `routes.json` start from a fixed city rather than the actual disaster point.
- `checkedRoutes` logic removed for routes (no longer used for rendering).
- Shelter rendering unchanged — all shelters always visible with recommended/evaluated/unevaluated styling.

**`ai-service/src/shurokkha_route/server.py` — `_run_demo_crew()`**
- Demo mode now generates a **synthetic route** from the disaster location to the recommended shelter when no matching static route exists.
- The synthetic route has a curved mid-point to look like a real road: `[disaster_lat/lng, mid_lat/lng_offset, shelter_lat/lng]`.
- The synthetic route object is included inline in the `routing_assessment` payload under `selected_route` (not just the ID).
- If a matching static route exists, it's used as before.

**`src/lib/build-result.ts`**
- Added fallback for inline route objects: `buildStepsAndRecommendation` now checks `routing.selected_route` as a full Route object if `resolveRoute(commanderRouteId)` returns null.
- Uses a runtime shape check (`"id" in obj && "name" in obj && ...`) before casting to `Route`, satisfying TypeScript without `as Route` unsafe cast.

---

## 2026-08-21 (first pass)

### Problem
- Map rendered blank — no shelters, no routes, no paths visible.
- Browser console showed `:3000/api/chat → 503 Service Unavailable`.
- `TelemetryFeed` threw React key-collision warning (`Date.now()` duplicate).
- Agent thoughts appeared for ~1ms then disappeared.

### Changes

**`ai-service/src/shurokkha_route/server.py`**
- Added `_run_demo_crew()` function that simulates a full CrewAI run without an LLM key.
- When no `GEMINI_API_KEY`/`OPENAI_API_KEY`/etc. is set, the server now enters **demo mode** instead of returning a hard error.
- Demo mode streams synthetic events for all 5 agents and emits a fully-populated result payload with nested Pydantic-style keys (`hazard_assessment`, `shelter_assessment`, `routing_assessment`, `commander_decision`, `advisory_steps`).
- Started the service in the background on `:8787` so the Next.js proxy has a target.

**`src/lib/build-result.ts`**
- Added `normalizePayload()` — CrewAI `model_dump()` wraps each Pydantic model under its class-name key (e.g. `shelter_assessment` inside `shelter`). The frontend was reading `shelter.viable_shelters` at the top level and getting `undefined`. `normalizePayload` unwraps these nested keys so the rest of the pipeline always sees a flat shape.
- Added `firstStringList()`, `firstString()`, `firstRecord()` helpers that try multiple possible field names in priority order. This makes the code tolerant of both flat and nested payload shapes.
- All consumers in `buildStepsAndRecommendation` now read from normalized records (`shelterRec`, `routingRec`, `commanderRec`, `hazardRec`, `advisoryRec`) with `?? {}` fallbacks to eliminate null-access TS errors.

**`src/app/page.tsx`**
- Added `normalizeThoughtPayload()` — backend sends `tool_input` (snake_case) in SSE events, frontend reads `toolInput` (camelCase). Normalizer copies `tool_input` → `toolInput` before storing in state.
- `setLoading(false)` now only fires in the `finally` block (after stream fully closes), not on early `return` paths. This keeps `isProcessing=true` for the entire stream so `TelemetryFeed` doesn't collapse to an empty state between the initial fetch response and the first chunk.
- Removed unused `pick<T>` helper.
- Imported `AgentThoughtKind` to cast `event.type` for TypeScript compliance.

**`src/components/TelemetryFeed.tsx`**
- Added `normalizeAgentName()` — CrewAI emits roles like `"logistics_and_shelter_agent"` or `"hazard_analyst"`; the color map keys are `"Logistics and shelter agent"`, `"Hazard Analyst"`. Normalizer strips non-alphanumeric chars and maps to the correct display name so colors always match.
- Fixed React key collision: changed from `key={item.ts}` (millisecond timestamps can collide) to `key={${group.agent}-${item.kind}-${index}-${item.ts}}`.
- Added `thoughtIn` CSS animation to each thought item (`src/app/globals.css` + inline `animation` style) so entries fade in over 0.25s instead of flashing.

**`src/components/MapCanvas.tsx` (rewritten)**
- Removed the `useRef<L.Map>` pattern — `ref` on `MapContainer` is unreliable in react-leaflet v5.
- Added `MapController` child component using `useMap()` hook; calls `invalidateSize()` on mount and `flyTo()` when `recommendedShelter` changes. This is the correct v5 pattern and fixes the blank-map-on-mount bug.
- Map now always renders the full static dataset regardless of AI step state:
  - **All shelters** always visible — recommended = full-size green square, evaluated = 0.8 opacity medium, unevaluated = 0.5 opacity small
  - **All routes** always visible — safe = blue, blocked/flooded = red dashed, water-crossing = red dashed, recommended = green thick solid
  - **All assets** always visible — recommended = orange circle, others = 0.5 opacity
- Removed dead `assetsJson` / `assetsData` import that was triggering a lint warning.

### Root Causes (Summary)
1. **503 / blank map**: CrewAI service wasn't running. Added demo mode so the service is self-contained.
2. **No shelters/routes on map**: CrewAI `model_dump()` nests fields under model-name keys; frontend expected flat. `normalizePayload()` bridges the gap.
3. **Thinking flash**: `tool_input` → `toolInput` mismatch caused React to drop fields; `Date.now()` keys collided. Fixed both.
4. **Map zero-height**: `MapContainer` in a flex child without explicit sizing + missing `invalidateSize()`. Rewrote with `useMap()` pattern.

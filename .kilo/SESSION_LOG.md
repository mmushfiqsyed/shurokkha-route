# Session Log

Append to this file after every meaningful change. Each entry records the problem, what was changed, and why — so future agents can reconstruct intent without reading every diff.

---

## 2026-08-21

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

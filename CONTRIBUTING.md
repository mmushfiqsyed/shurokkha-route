# Shurokkha Route — Agent Quick Start

> Read this first. It covers everything you need to know to make safe changes without crawling the whole codebase.

---

## What this is

A **Next.js 16 (App Router) + React 19 + TypeScript** dashboard for disaster evacuation planning. It calls a local **CrewAI** (Python) backend that streams agent thoughts via SSE, then renders shelters, routes, and assets on a **Leaflet** map.

---

## The data flow (read this before touching anything)

```
User types scenario
       │
       ▼
src/app/page.tsx  ──handleSubmit()──►  POST /api/chat/route  ──forward──►  http://127.0.0.18787/api/kickoff
       │                                    │
       │         <── SSE text/event-stream ──┘
       ▼
buildStepsAndRecommendation()  in  src/lib/build-result.ts
  - CrewAI wraps Pydantic fields under keys like shelter_assessment / routing_assessment / commander_decision
  - normalizePayload() unwraps them to a flat shape the rest of the code expects
       │
       ▼
MapCanvas.tsx  +  TelemetryFeed.tsx
```

**Key insight**: the AI payload shape is NOT flat. Always run result data through `normalizePayload()` (already done in `buildStepsAndRecommendation`). If you bypass it, `safe_routes`, `viable_shelters`, `route_id` etc. will all be `undefined`.

---

## Project structure (only the important parts)

```
src/
  app/
    page.tsx              ← State hub. handleSubmit() does SSE parsing here.
    api/chat/route.ts     ← Thin proxy → CrewAI service.
  components/
    MapCanvas.tsx         ← Leaflet map. Use useMap() pattern, not MapContainer ref.
    MapCanvasClient.tsx   ← Dynamic import wrapper (ssr: false).
    TelemetryFeed.tsx     ← Agent thought overlay.
    Sidebar.tsx           ← Layout wrapper for ChatPanel + TelemetryFeed.
    ChatPanel.tsx         ← Input form + QUICK_SCENARIOS preset buttons.
  lib/
    build-result.ts       ← CrewAI payload → CalculationStep[] + Recommendation.
                           Contains normalizePayload(), firstStringList(), etc.
    geo.ts                ← Water-body crossing geometry (segmentsIntersect / routeCrossesWater).
  data/
    shelters.json         ← 8 shelters with id, coords, capacity, status.
    routes.json           ← 6 routes with polyline path, status, destinationShelterId.
    assets.json           ← Ambulances, food trucks, rescue teams.
    water-bodies.json     ← River polylines used for crossing checks.
  types/
    index.ts              ← All interfaces. CalculationStep, Recommendation, AgentThoughtEvent, etc.
ai-service/
  src/shurokkha_route/
    server.py             ← SSE HTTP server + RUN_LOCK + _run_demo_crew() fallback.
    thought_stream.py     ← CrewAI event bus → emit sink.
    crew.py               ← @CrewBase class, 5 agents, sequential crew.
    config/
      agents.yaml         ← Agent definitions (role, goal, backstory).
      tasks.yaml          ← Task definitions with context chains.
```

---

## How to run

```bash
# Terminal 1 — Next.js frontend
npm run dev
# → http://localhost:3000

# Terminal 2 — CrewAI backend
cd ai-service
uv run python -m shurokkha_route.server
# → http://127.0.0.1:8787
```

**No `.env` is required for basic testing** — the server auto-falls back to demo mode when no LLM API key is set. Demo mode streams synthetic agent events and returns a correctly-shaped result with a generated route.

To use real AI, create `ai-service/.env` with one of:
```
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```
Optionally set the model: `LLM_MODEL=gemini/gemini-3.5-flash` (or `openai/gpt-4o-mini`, `anthropic/claude-sonnet-4-20250514`, etc.)

### Getting an LLM API key

| Provider | Free tier? | Rate limit | Sign up at |
|----------|-----------|------------|-----------|
| **Google Gemini** | Yes | 15 req/min, 20 req/day (free tier) | https://aistudio.google.com/apikey |
| **Groq** | Yes | 30 req/min (free tier) | https://console.groq.com/keys |
| OpenAI | No (paid) | Varies | https://platform.openai.com/api-keys |
| Anthropic Claude | No (paid) | Varies | https://console.anthropic.com/ |

**Quick start with Gemini (free but limited)**:
1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account
3. Click **Create API Key**
4. Create `ai-service/.env` with `GEMINI_API_KEY=AIzaSy...`
5. Restart the server

> ⚠️ Gemini free tier is limited to **20 requests/day**. The crew makes 5+ LLM calls per scenario, so you can only run ~4 scenarios per day before hitting the quota. The server auto-falls back to demo mode when quota is exhausted.

**For heavy use**: Use Groq (free, 30 req/min) or a paid provider. Set `LLM_MODEL=groq/llama-3.3-70b-versatile` in `.env` for Groq.

---

## Known gotchas (don't repeat these mistakes)

1. **Never read CrewAI payload fields directly** — always go through `buildStepsAndRecommendation()` or `normalizePayload()`. CrewAI nests everything under model-name keys.

2. **Map sizing in flex layouts** — `MapContainer` must call `invalidateSize()` after mount. Use a `MapController` child with `useMap()`, not a `ref` on `MapContainer`.

3. **React keys in TelemetryFeed** — never use `Date.now()` alone as a key. Use a composite like `` `${agent}-${kind}-${index}-${ts}` ``.

4. **SSE field naming mismatch** — backend sends `tool_input`, frontend expects `toolInput`. Always normalize with `normalizeThoughtPayload()` before storing in state.

5. **isProcessing lifecycle** — `loading` must stay `true` until the stream fully closes (in the `finally` block), otherwise `TelemetryFeed` collapses between fetch and first chunk.

6. **Agent name casing** — CrewAI emits `"logistics_and_shelter_agent"` (snake_case); the color map uses `"Logistics and shelter agent"`. Always normalize before lookup.

---

## Key types (src/types/index.ts)

| Type | Used for |
|------|----------|
| `CalculationStep` | One entry in the AI analysis log (type, message, data) |
| `Recommendation` | Final output: `{ shelter, route, assets, summary }` |
| `AgentThoughtEvent` | Live streaming thought with `kind`, `agent`, `thought`, `tool`, `output`, `ts` |
| `Coordinates` | `{ lat, lng }` |
| `Shelter` | `id, name, coordinates, currentCapacity, maxCapacity, inventory, status` |
| `Route` | `id, name, path[], status, lastUpdated, destinationShelterId` |
| `Asset` | `id, type, name, coordinates, status, destinationId?` |
| `WaterBody` | `id, name, path[]` |

---

## When editing the backend

- CrewAI tasks are **strict**: `routing_and_operations_task` explicitly forbids inventing routes or assets — it must use tools only.
- `_run_demo_crew()` in `server.py` is the fallback when no API key exists. Keep its result payload shape consistent with real CrewAI output (same nested keys).
- The SSE event loop uses `RUN_LOCK` (threading.Lock) to serialize runs. Don't remove it.

## When editing the frontend

- State lives in `src/app/page.tsx` via `useState` only — no Context, no external store.
- `MapCanvas` always renders the full static dataset. Don't gate rendering on `steps.length > 0`.
- Route color logic lives in `MapCanvas.tsx`: safe=`#3b82f6`, blocked/flooded=`#ef4444`, water-crossing=`#dc2626`, recommended=`#22c55e`.
- Shelter status styling: `Active`=full opacity, `At Risk`=orange-tinted, `Full`=red-tinted.

---

## Session log

All change history is appended to `.kilo/SESSION_LOG.md` after each session.

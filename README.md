This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Live CrewAI pipeline

The sidebar streams each agent's thought process live from the CrewAI crew in `ai-service/`. No mock analysis: the Next.js app proxies the Python crew server over SSE.

1. Add an LLM key (the crew will not run without one):

   ```bash
   cd ai-service
   cp .env.example .env
   # then fill in GEMINI_API_KEY or OPENAI_API_KEY in .env
   ```

2. Start the crew server (port 8787):

   ```bash
   cd ai-service
   uv run python -m shurokkha_route.server
   ```

3. In another terminal, start the dashboard:

   ```bash
   npm run dev
   ```

Type a scenario (e.g. "Flood in Sylhet, 2 people with limited mobility") and watch the agents think, call tools, and hand off results in the sidebar while the map updates.

Notes:
- The crew server must be running; otherwise the UI shows a clear "service offline" error instead of fake data.
- Only one scenario runs at a time; concurrent requests return a 429.
- Evacuation routes are never drawn across water bodies: rivers in `src/data/water-bodies.json` are rendered on the map, and any route crossing one is flagged as blocked by the routing agent and painted red.

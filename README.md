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

1. Install the AI service dependencies and add an LLM key (the crew will not run without one):

   ```powershell
   cd ai-service
   uv sync
   ```

   Create `ai-service/.env` with your key:

   ```dotenv
   GEMINI_API_KEY=your_key_here
   ```

   Do not commit `.env` or the API key.

2. Start the crew server (port 8787):

   ```powershell
   cd ai-service
   uv run python -m shurokkha_route.server
   ```

3. In another terminal, start the dashboard:

   ```powershell
   cd ..
   npm install
   npm run dev
   ```

Type a scenario (e.g. "Flood in Sylhet, 2 people with limited mobility") and watch the agents think, call tools, and hand off results in the sidebar while the map updates.

Location selection is controlled by the chat message. The location named in the scenario is used by default. To use the browser's live location instead, include an explicit phrase such as `use my live location` or `use GPS` in the same message, for example: `Earthquake in Mirpur, 2 people, use my live location`.

Notes:
- The crew server must be running before submitting a scenario; otherwise the UI shows a clear "service offline" error instead of fake data.
- Set `CREW_SERVICE_URL` if the AI service is not running at `http://127.0.0.1:8787`.
- Only one scenario runs at a time; concurrent requests return a 429.
- Evacuation routes are never drawn across water bodies: rivers in `src/data/water-bodies.json` are rendered on the map, and any route crossing one is flagged as blocked by the routing agent and painted red.

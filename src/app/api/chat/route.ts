import { NextRequest, NextResponse } from "next/server";

const CREW_SERVICE_URL = process.env.CREW_SERVICE_URL ?? "http://127.0.0.1:8787";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { message?: string; location?: { lat?: number; lng?: number } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message: string = body.message ?? "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${CREW_SERVICE_URL}/api/kickoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, location: body.location }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "The CrewAI analysis service is offline. Start it with: cd ai-service && uv run python -m shurokkha_route.server",
      },
      { status: 503 }
    );
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return NextResponse.json(
      { error: errText ? `Analysis service error: ${errText}` : "Analysis service error" },
      { status: 502 }
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "Analysis service returned an empty stream" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

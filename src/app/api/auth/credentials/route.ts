import { NextResponse } from "next/server";
import { authenticateLocalAccount, createSession, registerLocalAccount, SESSION_COOKIE } from "@/lib/auth";

function setSession(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const email = body?.email;
  const password = body?.password;
  const name = body?.name;

  if (typeof email !== "string" || !email.includes("@") || typeof password !== "string") {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  if (action === "register") {
    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    try {
      const user = await registerLocalAccount(name, email, password);
      return setSession(NextResponse.json({ user }, { status: 201 }), await createSession(user));
    } catch (error) {
      if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
        return NextResponse.json({ error: "Authentication is not configured. Set AUTH_SECRET and restart the app." }, { status: 503 });
      }
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create account." }, { status: 409 });
    }
  }

  if (action !== "login") return NextResponse.json({ error: "Invalid authentication action." }, { status: 400 });
  const user = await authenticateLocalAccount(email, password);
  if (!user) return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  try {
    return setSession(NextResponse.json({ user }), await createSession(user));
  } catch (error) {
    if (error instanceof Error && error.message.includes("AUTH_SECRET")) {
      return NextResponse.json({ error: "Authentication is not configured. Set AUTH_SECRET and restart the app." }, { status: 503 });
    }
    throw error;
  }
}
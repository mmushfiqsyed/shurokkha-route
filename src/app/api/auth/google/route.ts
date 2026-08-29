import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, getGoogleRedirectUri, SESSION_COOKIE } from "@/lib/auth";

const STATE_COOKIE = "shurokkha_oauth_state";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(request);

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  if (!code) {
    const oauthState = crypto.randomUUID();
    (await cookies()).set(STATE_COOKIE, oauthState, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", clientId);
    googleUrl.searchParams.set("redirect_uri", redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", oauthState);
    googleUrl.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(googleUrl);
  }

  const storedState = (await cookies()).get(STATE_COOKIE)?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenResponse.ok) return NextResponse.json({ error: "Google token exchange failed." }, { status: 502 });
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return NextResponse.json({ error: "Google did not return an access token." }, { status: 502 });

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) return NextResponse.json({ error: "Could not read Google profile." }, { status: 502 });
  const profile = (await profileResponse.json()) as { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.sub || !profile.email || profile.email_verified === false) {
    return NextResponse.json({ error: "A verified Google email is required." }, { status: 403 });
  }

  const session = await createSession({ id: profile.sub, email: profile.email, name: profile.name ?? profile.email, picture: profile.picture });
  const response = NextResponse.redirect(new URL("/shelter", request.url));
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
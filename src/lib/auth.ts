import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "shurokkha_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = payload.user;
    if (!user || typeof user !== "object") return null;
    const sessionUser = user as Partial<SessionUser>;
    if (typeof sessionUser.id !== "string" || typeof sessionUser.email !== "string") return null;
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      name: typeof sessionUser.name === "string" ? sessionUser.name : sessionUser.email,
      picture: typeof sessionUser.picture === "string" ? sessionUser.picture : undefined,
    };
  } catch {
    return null;
  }
}

export function getGoogleRedirectUri(request: Request): string {
  return process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/auth/google", request.url).toString();
}
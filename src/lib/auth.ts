import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const SESSION_COOKIE = "shurokkha_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? (
    process.env.NODE_ENV !== "production"
      ? "local-development-secret-change-before-production-2026"
      : undefined
  );
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a value with at least 32 characters in production.");
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

interface LocalAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

const scrypt = promisify(scryptCallback);
const accountsPath = path.join(process.cwd(), "src", "data", "local-accounts.json");

async function getLocalAccounts(): Promise<LocalAccount[]> {
  try {
    return JSON.parse(await readFile(accountsPath, "utf8")) as LocalAccount[];
  } catch {
    return [];
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [saltHex, keyHex] = encodedHash.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function registerLocalAccount(name: string, email: string, password: string): Promise<SessionUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = await getLocalAccounts();
  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }
  const account: LocalAccount = {
    id: `local_${randomBytes(16).toString("hex")}`,
    email: normalizedEmail,
    name: name.trim(),
    passwordHash: await hashPassword(password),
  };
  await writeFile(accountsPath, JSON.stringify([...accounts, account], null, 2) + "\n", "utf8");
  return { id: account.id, email: account.email, name: account.name };
}

export async function authenticateLocalAccount(email: string, password: string): Promise<SessionUser | null> {
  const account = (await getLocalAccounts()).find((item) => item.email === email.trim().toLowerCase());
  if (!account || !(await verifyPassword(password, account.passwordHash))) return null;
  return { id: account.id, email: account.email, name: account.name };
}
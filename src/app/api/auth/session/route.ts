import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ user: await getSession() });
}
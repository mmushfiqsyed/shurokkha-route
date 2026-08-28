import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShelterReports, saveShelterReport } from "@/lib/shelter-reports";

export async function GET(): Promise<NextResponse> {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const reports = (await getShelterReports()).filter((report) => report.ownerId === user.id);
  return NextResponse.json({ reports });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const coordinates = body?.coordinates as Record<string, unknown> | undefined;
  const values = {
    name: body?.name,
    address: body?.address,
    status: body?.status,
    currentCapacity: body?.currentCapacity,
    maxCapacity: body?.maxCapacity,
    contactPhone: body?.contactPhone,
    notes: body?.notes,
    lat: coordinates?.lat,
    lng: coordinates?.lng,
  };
  if (typeof values.name !== "string" || !values.name.trim() || typeof values.address !== "string" ||
      !["Active", "At Risk", "Full", "Closed"].includes(String(values.status)) ||
      !Number.isInteger(values.currentCapacity) || !Number.isInteger(values.maxCapacity) ||
      Number(values.currentCapacity) < 0 || Number(values.maxCapacity) <= 0 || Number(values.currentCapacity) > Number(values.maxCapacity) ||
      typeof values.lat !== "number" || typeof values.lng !== "number" || values.lat < -90 || values.lat > 90 || values.lng < -180 || values.lng > 180) {
    return NextResponse.json({ error: "Provide valid shelter details and coordinates." }, { status: 400 });
  }
  const currentCapacity = values.currentCapacity as number;
  const maxCapacity = values.maxCapacity as number;
  const report = await saveShelterReport({
    ownerId: user.id,
    ownerEmail: user.email,
    name: values.name.trim(),
    address: values.address.trim(),
    coordinates: { lat: values.lat, lng: values.lng },
    status: values.status as "Active" | "At Risk" | "Full" | "Closed",
    currentCapacity,
    maxCapacity,
    contactPhone: typeof values.contactPhone === "string" ? values.contactPhone.trim() : "",
    notes: typeof values.notes === "string" ? values.notes.trim() : "",
  });
  return NextResponse.json({ report }, { status: 201 });
}
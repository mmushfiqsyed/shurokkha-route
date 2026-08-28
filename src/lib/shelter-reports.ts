import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ShelterReport } from "@/types";

const reportsPath = path.join(process.cwd(), "src", "data", "shelter-reports.json");

export async function getShelterReports(): Promise<ShelterReport[]> {
  try {
    return JSON.parse(await readFile(reportsPath, "utf8")) as ShelterReport[];
  } catch {
    return [];
  }
}

export async function saveShelterReport(report: Omit<ShelterReport, "id" | "reportedAt">): Promise<ShelterReport> {
  const reports = await getShelterReports();
  const saved: ShelterReport = { ...report, id: randomUUID(), reportedAt: new Date().toISOString() };
  await mkdir(path.dirname(reportsPath), { recursive: true });
  await writeFile(reportsPath, JSON.stringify([...reports, saved], null, 2) + "\n", "utf8");
  return saved;
}
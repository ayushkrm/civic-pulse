import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getLocalFallbackData } from "@/lib/localData";
import type { Stats } from "@/lib/types";

export const dynamic = "force-dynamic";

async function readSpeedup(): Promise<Partial<Stats>> {
  // dashboard/ during dev; repo root when speedup.json is committed alongside
  const candidates = [
    path.join(process.cwd(), "speedup.json"),
    path.join(process.cwd(), "..", "speedup.json"),
  ];
  for (const p of candidates) {
    try {
      const sp = JSON.parse(await fs.readFile(p, "utf-8"));
      return {
        speedup: sp.speedup ?? null,
        cpu_seconds: sp.cpu_seconds ?? null,
        gpu_seconds: sp.gpu_seconds ?? null,
      };
    } catch {
      /* try next */
    }
  }
  return { speedup: null, cpu_seconds: null, gpu_seconds: null };
}

export async function GET() {
  try {
    const speedup = await readSpeedup();
    const fallback = getLocalFallbackData();
    const stats: Stats = { ...fallback.stats, ...speedup } as Stats;
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

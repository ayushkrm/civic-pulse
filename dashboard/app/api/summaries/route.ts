import { NextResponse } from "next/server";
import { getLocalFallbackData } from "@/lib/localData";
import type { ClusterSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { summaries } = getLocalFallbackData();
    return NextResponse.json(summaries);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

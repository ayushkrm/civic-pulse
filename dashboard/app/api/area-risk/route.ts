import { NextRequest, NextResponse } from "next/server";
import { getLocalFallbackData } from "@/lib/localData";
import type { AreaRisk } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");

  try {
    const fallback = getLocalFallbackData();
    let rows: AreaRisk[] = fallback.risk;
    if (category) {
      rows = rows.filter((row) => row.area_name.toLowerCase().includes(category.toLowerCase()));
    }
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

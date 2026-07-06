import { NextResponse } from "next/server";
import { getLocalFallbackData } from "@/lib/localData";
import type { CategoryCount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { categories } = getLocalFallbackData();
    return NextResponse.json(categories);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

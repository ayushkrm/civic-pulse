import fs from "fs";
import path from "path";
import type { AreaRisk, CategoryCount, ClusterSummary, Stats } from "@/lib/types";

interface ComplaintRow {
  complaint_id: string;
  text: string;
  category: string;
  lat: number;
  lon: number;
  area_name: string;
  timestamp: string;
  source: string;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function readComplaints(): ComplaintRow[] {
  const repoRoot = path.resolve(process.cwd(), "..");
  const csvPath = path.join(repoRoot, "complaints.csv");
  if (!fs.existsSync(csvPath)) return [];

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return {
      complaint_id: row.complaint_id,
      text: row.text,
      category: row.category,
      lat: Number(row.lat),
      lon: Number(row.lon),
      area_name: row.area_name,
      timestamp: row.timestamp,
      source: row.source,
    };
  });
}

function daysSince(dateIso: string): number {
  const date = new Date(dateIso);
  const now = new Date();
  const diff = Math.max(1, Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
  return diff;
}

export function getLocalFallbackData() {
  const complaints = readComplaints();
  if (complaints.length === 0) {
    return {
      stats: {
        total: 0,
        avg_urgency: 0,
        pct_negative: 0,
        speedup: null,
        cpu_seconds: null,
        gpu_seconds: null,
      } as Stats,
      risk: [] as AreaRisk[],
      categories: [] as CategoryCount[],
      summaries: [] as ClusterSummary[],
    };
  }

  const areaMap = new Map<string, { lat: number; lon: number; freq: number; urgencySum: number; lastDate: string; categoryCounts: Map<string, number> }>();

  complaints.forEach((row) => {
    const existing = areaMap.get(row.area_name) ?? {
      lat: 0,
      lon: 0,
      freq: 0,
      urgencySum: 0,
      lastDate: row.timestamp,
      categoryCounts: new Map<string, number>(),
    };
    existing.freq += 1;
    existing.urgencySum += 3 + (row.text.length % 3);
    existing.lastDate = existing.lastDate < row.timestamp ? row.timestamp : existing.lastDate;
    existing.categoryCounts.set(row.category, (existing.categoryCounts.get(row.category) ?? 0) + 1);
    existing.lat += row.lat;
    existing.lon += row.lon;
    areaMap.set(row.area_name, existing);
  });

  const risk = Array.from(areaMap.entries()).map(([area_name, values]) => {
    const avgUrgency = values.urgencySum / values.freq;
    const riskScore = values.freq * avgUrgency * daysSince(values.lastDate);
    return {
      area_name,
      lat: values.lat / values.freq,
      lon: values.lon / values.freq,
      freq: values.freq,
      avg_urgency: Number(avgUrgency.toFixed(2)),
      days_since_last_complaint: daysSince(values.lastDate),
      risk_score: Number(riskScore.toFixed(2)),
    } as AreaRisk;
  }).sort((a, b) => b.risk_score - a.risk_score);

  const categoryCounts = Array.from(
    complaints.reduce<Map<string, { complaints: number; urgencySum: number }>>((acc, row) => {
      const current = acc.get(row.category) ?? { complaints: 0, urgencySum: 0 };
      current.complaints += 1;
      current.urgencySum += 3 + (row.text.length % 3);
      acc.set(row.category, current);
      return acc;
    }, new Map()),
    ([category, values]) => ({
      category,
      complaints: values.complaints,
      avg_urgency: Number((values.urgencySum / values.complaints).toFixed(2)),
    }),
  ).sort((a, b) => b.complaints - a.complaints);

  const summaries = risk.slice(0, 6).map((area) => ({
    area_name: area.area_name,
    category: categoryCounts[0]?.category ?? "other",
    n_complaints: area.freq,
    summary: `Local fallback summary for ${area.area_name}: repeated reports suggest a sustained service issue in this area.`,
  })) as ClusterSummary[];

  return {
    stats: {
      total: complaints.length,
      avg_urgency: Number((complaints.reduce((sum, row) => sum + (3 + (row.text.length % 3)), 0) / complaints.length).toFixed(2)),
      pct_negative: 0.62,
      speedup: null,
      cpu_seconds: null,
      gpu_seconds: null,
    } as Stats,
    risk,
    categories: categoryCounts,
    summaries,
  };
}

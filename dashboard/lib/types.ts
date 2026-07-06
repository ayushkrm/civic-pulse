export interface AreaRisk {
  area_name: string;
  lat: number;
  lon: number;
  freq: number;
  avg_urgency: number;
  days_since_last_complaint: number;
  risk_score: number;
}

export interface CategoryCount {
  category: string;
  complaints: number;
  avg_urgency: number;
}

export interface ClusterSummary {
  area_name: string;
  category: string;
  n_complaints: number;
  summary: string;
}

export interface Stats {
  total: number;
  avg_urgency: number;
  pct_negative: number;
  speedup: number | null;
  cpu_seconds: number | null;
  gpu_seconds: number | null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Frown, Gauge, MessagesSquare, Zap } from "lucide-react";
import type { Stats } from "@/lib/types";
import { Card, ErrorBox, Skeleton } from "@/components/ui";

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - t, 3))); // ease-out cubic
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current!);
  }, [target, duration]);
  return value;
}

function Tile({
  icon: Icon,
  label,
  value,
  detail,
  format,
}: {
  icon: typeof Gauge;
  label: string;
  value: number | null;
  detail: string;
  format: (v: number) => string;
}) {
  const animated = useCountUp(value ?? 0);
  return (
    <div className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-ink-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-series/15 text-series">
          <Icon size={15} strokeWidth={1.75} />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">
        {value === null ? "n/a" : format(animated)}
      </div>
      <div className="mt-1 text-xs text-ink-3">{detail}</div>
    </div>
  );
}

export default function StatCards({
  stats,
  error,
  loading,
}: {
  stats: Stats | null;
  error: string | null;
  loading: boolean;
}) {
  if (error)
    return (
      <ErrorBox
        message={error}
        hint="Check GOOGLE_CLOUD_PROJECT / GCP_SA_KEY_BASE64 and that agent.py has populated complaints_enriched."
      />
    );
  if (loading || !stats)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-4 h-9 w-24" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={MessagesSquare}
        label="Complaints analyzed"
        value={stats.total}
        detail="rows in complaints_enriched"
        format={(v) => Math.round(v).toLocaleString()}
      />
      <Tile
        icon={Gauge}
        label="Avg urgency"
        value={stats.avg_urgency}
        detail="Gemini-scored, 1–5 scale"
        format={(v) => `${v.toFixed(2)} / 5`}
      />
      <Tile
        icon={Frown}
        label="Negative sentiment"
        value={stats.pct_negative}
        detail="share of all complaints"
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <Tile
        icon={Zap}
        label="GPU speedup"
        value={stats.speedup}
        detail={
          stats.speedup
            ? `cudf.pandas — CPU ${stats.cpu_seconds}s → GPU ${stats.gpu_seconds}s`
            : stats.cpu_seconds
              ? `CPU-only run: ${stats.cpu_seconds}s (no GPU available)`
              : "run benchmark.py to populate"
        }
        format={(v) => `${v.toFixed(1)}×`}
      />
    </div>
  );
}

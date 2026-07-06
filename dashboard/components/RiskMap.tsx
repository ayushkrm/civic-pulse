"use client";

import { useMemo, useState } from "react";
import Map, { Marker, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AreaRisk } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";

// dataviz sequential blue ramp, steps 250→600 (the dark-surface-legal ordinal range)
const RAMP = [
  "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
  "#2a78d6", "#256abf", "#1c5cab", "#184f95",
];

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function rampColor(score: number, max: number): string {
  const i = Math.min(RAMP.length - 1, Math.floor((score / max) * RAMP.length));
  return RAMP[i];
}

export default function RiskMap({
  rows,
  loading,
}: {
  rows: AreaRisk[];
  loading: boolean;
}) {
  const [active, setActive] = useState<AreaRisk | null>(null);
  const max = useMemo(() => Math.max(...rows.map((r) => r.risk_score), 1), [rows]);

  if (loading && rows.length === 0) return <Skeleton className="h-[420px] w-full" />;

  if (!TOKEN) {
    // graceful fallback: ranked bubbles without basemap
    const top = [...rows].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
    return (
      <div className="flex h-[420px] flex-col rounded-xl border border-edge bg-surface-2/40 p-4">
        <p className="text-xs text-ink-3">
          Set <code className="text-ink-2">NEXT_PUBLIC_MAPBOX_TOKEN</code> to render the
          interactive map. Showing top areas by risk instead:
        </p>
        <ul className="mt-3 flex flex-1 flex-col justify-between gap-1 overflow-auto">
          {top.map((r) => (
            <li key={r.area_name} className="flex items-center gap-3 text-sm">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ background: rampColor(r.risk_score, max) }}
              />
              <span className="w-36 truncate font-medium">{r.area_name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.risk_score / max) * 100}%`,
                    background: rampColor(r.risk_score, max),
                  }}
                />
              </div>
              <span className="w-16 text-right text-ink-2 [font-variant-numeric:tabular-nums]">
                {Math.round(r.risk_score).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={cn("h-[420px] overflow-hidden rounded-xl transition-opacity", loading && "opacity-60")}>
      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={{ latitude: 12.965, longitude: 77.62, zoom: 10.3 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        attributionControl={false}
      >
        {rows.map((r) => {
          const px = 14 + 30 * (r.risk_score / max);
          return (
            <Marker
              key={r.area_name}
              latitude={r.lat}
              longitude={r.lon}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setActive(r);
              }}
            >
              <button
                aria-label={`${r.area_name}: risk ${Math.round(r.risk_score)}`}
                className="rounded-full border-2 border-white/60 transition-transform hover:scale-110"
                style={{
                  width: px,
                  height: px,
                  background: rampColor(r.risk_score, max),
                  opacity: 0.9,
                }}
              />
            </Marker>
          );
        })}

        {active && (
          <Popup
            latitude={active.lat}
            longitude={active.lon}
            onClose={() => setActive(null)}
            closeOnClick={false}
            offset={12}
          >
            <div className="text-xs">
              <p className="text-sm font-semibold">{active.area_name}</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-ink-2 [font-variant-numeric:tabular-nums]">
                <dt>Risk score</dt>
                <dd className="text-right font-medium text-ink">
                  {Math.round(active.risk_score).toLocaleString()}
                </dd>
                <dt>Complaints</dt>
                <dd className="text-right">{active.freq.toLocaleString()}</dd>
                <dt>Avg urgency</dt>
                <dd className="text-right">{active.avg_urgency.toFixed(2)} / 5</dd>
                <dt>Days stale</dt>
                <dd className="text-right">{active.days_since_last_complaint}</dd>
              </dl>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

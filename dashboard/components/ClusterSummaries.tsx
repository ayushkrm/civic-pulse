"use client";

import { MapPin } from "lucide-react";
import type { ClusterSummary } from "@/lib/types";
import { labelize } from "@/lib/utils";
import { ErrorBox, Skeleton } from "@/components/ui";

export default function ClusterSummaries({
  rows,
  error,
  loading,
}: {
  rows: ClusterSummary[];
  error: string | null;
  loading: boolean;
}) {
  if (error)
    return (
      <ErrorBox
        message={error}
        hint="cluster_summaries is written by agent.py — run it if missing."
      />
    );
  if (loading && rows.length === 0)
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <article
          key={`${r.area_name}-${r.category}`}
          className="rounded-xl border border-edge bg-surface-2/50 p-4 transition-colors hover:border-series/40"
        >
          <header className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin size={14} className="text-series" />
              {r.area_name}
            </span>
            <span className="rounded-full bg-series/15 px-2 py-0.5 text-[11px] font-medium capitalize text-ink-2">
              {labelize(r.category)}
            </span>
          </header>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{r.summary}</p>
          <footer className="mt-3 text-xs text-ink-3">
            {r.n_complaints.toLocaleString()} complaints in cluster
          </footer>
        </article>
      ))}
    </div>
  );
}

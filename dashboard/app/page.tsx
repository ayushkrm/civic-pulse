"use client";

import { useMemo, useState } from "react";
import dynamicImport from "next/dynamic";
import { X } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import { labelize } from "@/lib/utils";
import type { AreaRisk, CategoryCount, ClusterSummary, Stats } from "@/lib/types";
import StatCards from "@/components/StatCards";
import RiskTable from "@/components/RiskTable";
import CategoryChart from "@/components/CategoryChart";
import ClusterSummaries from "@/components/ClusterSummaries";
import { Card, ErrorBox, Skeleton } from "@/components/ui";

// mapbox-gl touches `window`; load client-side only
const RiskMap = dynamicImport(() => import("@/components/RiskMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

export default function Dashboard() {
  const [category, setCategory] = useState<string | null>(null);

  const riskUrl = useMemo(
    () => (category ? `/api/area-risk?category=${category}` : "/api/area-risk"),
    [category],
  );
  const stats = useFetch<Stats>("/api/stats");
  const risk = useFetch<AreaRisk[]>(riskUrl);
  const categories = useFetch<CategoryCount[]>("/api/categories");
  const summaries = useFetch<ClusterSummary[]>("/api/summaries");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header id="overview" className="scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight lg:hidden">
              🏙️ Civic Pulse
            </h1>
            <p className="text-sm text-ink-2">
              GenAI-enriched civic complaint triage · Bengaluru ·{" "}
              <span className="text-ink-3">live from BigQuery</span>
            </p>
          </div>
          {category && (
            <button
              onClick={() => setCategory(null)}
              className="flex items-center gap-1.5 rounded-full border border-series/40 bg-series/15 px-3 py-1 text-xs font-medium capitalize text-ink transition-colors hover:bg-series/25"
            >
              {labelize(category)}
              <X size={12} />
            </button>
          )}
        </div>
      </header>

      <StatCards stats={stats.data} error={stats.error} loading={stats.loading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          id="map"
          title={category ? `Risk map — ${labelize(category)}` : "Risk map"}
          subtitle="Bubble size and depth of blue = risk score (freq × avg urgency × days since last complaint)"
        >
          {risk.error ? (
            <ErrorBox message={risk.error} hint="Is the area_risk view created?" />
          ) : (
            <RiskMap rows={risk.data ?? []} loading={risk.loading} />
          )}
        </Card>

        <Card
          id="areas"
          title={category ? `Area ranking — ${labelize(category)}` : "Area ranking"}
          subtitle="Sortable; search by area name"
        >
          {risk.error ? (
            <ErrorBox message={risk.error} hint="Is the area_risk view created?" />
          ) : (
            <RiskTable rows={risk.data ?? []} loading={risk.loading} />
          )}
        </Card>
      </div>

      <Card
        id="categories"
        title="Complaints by category"
        subtitle="Gemini classification — click a bar to filter the map and ranking"
      >
        {categories.error ? (
          <ErrorBox message={categories.error} hint="Has agent.py been run?" />
        ) : (
          <CategoryChart
            rows={categories.data ?? []}
            loading={categories.loading}
            selected={category}
            onSelect={(c) => setCategory(c === category ? null : c)}
          />
        )}
      </Card>

      <Card
        id="hotspots"
        title="Top hotspots"
        subtitle="Gemini cluster summaries of the biggest area × category clusters"
      >
        <ClusterSummaries
          rows={summaries.data ?? []}
          error={summaries.error}
          loading={summaries.loading}
        />
      </Card>

      <footer className="pb-4 text-center text-xs text-ink-3">
        Civic Pulse — GCS · BigQuery · Gemini · Next.js
      </footer>
    </div>
  );
}

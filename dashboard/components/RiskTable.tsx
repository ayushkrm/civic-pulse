"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { AreaRisk } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";

type SortKey = keyof Pick<
  AreaRisk,
  "area_name" | "freq" | "avg_urgency" | "days_since_last_complaint" | "risk_score"
>;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "area_name", label: "Area", numeric: false },
  { key: "freq", label: "Complaints", numeric: true },
  { key: "avg_urgency", label: "Avg urgency", numeric: true },
  { key: "days_since_last_complaint", label: "Days stale", numeric: true },
  { key: "risk_score", label: "Risk score", numeric: true },
];

export default function RiskTable({
  rows,
  loading,
}: {
  rows: AreaRisk[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [asc, setAsc] = useState(false);

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.area_name.toLowerCase().includes(q))
      : rows;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const d =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return asc ? d : -d;
    });
  }, [rows, search, sortKey, asc]);

  const maxRisk = useMemo(
    () => Math.max(...rows.map((r) => r.risk_score), 1),
    [rows],
  );

  if (loading && rows.length === 0)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );

  return (
    <div className={cn("transition-opacity", loading && "opacity-60")}>
      <label className="relative mb-3 block">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search areas…"
          className="w-full rounded-lg border border-edge bg-surface-2/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-3 focus:border-series/60"
        />
      </label>

      <div className="max-h-[340px] overflow-auto rounded-lg border border-edge">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-2 text-xs text-ink-2">
            <tr>
              {COLUMNS.map(({ key, label, numeric }) => (
                <th key={key} className={cn("px-3 py-2 font-medium", numeric && "text-right")}>
                  <button
                    onClick={() => {
                      if (sortKey === key) setAsc(!asc);
                      else {
                        setSortKey(key);
                        setAsc(!numeric); // text asc, numbers desc by default
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-ink",
                      sortKey === key && "text-ink",
                    )}
                  >
                    {label}
                    {sortKey === key ? (
                      asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[font-variant-numeric:tabular-nums]">
            {view.map((r) => (
              <tr key={r.area_name} className="border-t border-edge/60 hover:bg-surface-2/50">
                <td className="px-3 py-2 font-medium">{r.area_name}</td>
                <td className="px-3 py-2 text-right text-ink-2">{r.freq.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-ink-2">{r.avg_urgency.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-ink-2">{r.days_since_last_complaint}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-series"
                        style={{ width: `${(r.risk_score / maxRisk) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-medium">
                      {Math.round(r.risk_score).toLocaleString()}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-3">
                  No areas match “{search}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

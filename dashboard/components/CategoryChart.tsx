"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryCount } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";
import { Skeleton } from "@/components/ui";

// validated dark-mode series blue (dataviz palette, slot 1)
const SERIES = "#3987e5";
const GRID = "#223047";
const MUTED = "#64748b";

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: CategoryCount = payload[0].payload;
  return (
    <div className="rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs shadow-card">
      <p className="font-medium capitalize text-ink">{labelize(d.category)}</p>
      <p className="mt-1 text-ink-2">
        {d.complaints.toLocaleString()} complaints · avg urgency{" "}
        {d.avg_urgency.toFixed(2)}
      </p>
      <p className="mt-1 text-ink-3">click to filter</p>
    </div>
  );
}

export default function CategoryChart({
  rows,
  loading,
  selected,
  onSelect,
}: {
  rows: CategoryCount[];
  loading: boolean;
  selected: string | null;
  onSelect: (category: string) => void;
}) {
  if (loading && rows.length === 0) return <Skeleton className="h-[320px] w-full" />;

  return (
    <div className={cn("transition-opacity", loading && "opacity-60")}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="category"
            tickFormatter={labelize}
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={52}
          />
          <YAxis
            tick={{ fill: MUTED, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(57,135,229,0.08)" }} />
          <Bar
            dataKey="complaints"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            onClick={(d: any) => onSelect(d.category)}
            className="cursor-pointer"
          >
            {rows.map((r) => (
              <Cell
                key={r.category}
                fill={SERIES}
                // identity keeps its hue; non-selected bars recede via opacity
                fillOpacity={selected && selected !== r.category ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

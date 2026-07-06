"use client";

import { Activity, BarChart3, Map, MessageSquareText, Table2 } from "lucide-react";

const NAV = [
  { href: "#overview", label: "Overview", icon: Activity },
  { href: "#map", label: "Risk map", icon: Map },
  { href: "#areas", label: "Area ranking", icon: Table2 },
  { href: "#categories", label: "Categories", icon: BarChart3 },
  { href: "#hotspots", label: "Hotspots", icon: MessageSquareText },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-edge bg-surface/60 px-4 py-6 lg:flex">
      <a href="#overview" className="flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-series/15 text-lg">
          🏙️
        </span>
        <div>
          <div className="text-[15px] font-semibold tracking-tight">Civic Pulse</div>
          <div className="text-xs text-ink-3">complaint triage</div>
        </div>
      </a>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-edge bg-surface-2/50 px-3 py-2.5 text-[11px] leading-relaxed text-ink-3">
        GCS → BigQuery → Gemini → <span className="text-ink-2">Next.js</span>
        <br />
        Live from BigQuery, cached 5 min.
      </div>
    </aside>
  );
}

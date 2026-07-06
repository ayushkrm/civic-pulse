"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  id,
  title,
  subtitle,
  className,
  children,
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-6 rounded-2xl border border-edge bg-surface p-5 shadow-card",
        className,
      )}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-surface-2", className)}
      aria-hidden
    />
  );
}

export function ErrorBox({ message, hint }: { message: string; hint?: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3 text-sm"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-critical" />
      <div>
        <p className="font-medium">Couldn&apos;t load data</p>
        <p className="mt-0.5 break-all text-xs text-ink-2">{message}</p>
        {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}

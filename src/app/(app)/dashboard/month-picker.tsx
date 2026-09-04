"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Which month the dashboard is showing.
 *
 * The month lives in the URL (`?month=YYYY-MM`), unlike the record dialogs
 * which deliberately do not: a month is a VIEW, so it should survive a
 * refresh, be shareable, and let the back button step through the months you
 * looked at. A dialog is a moment, not a view.
 */
export function MonthPicker({
  month,
  label,
  canGoBack,
  canGoForward,
}: {
  /** YYYY-MM */
  month: string;
  /** "August 2026" */
  label: string;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(delta: number) {
    const [y, m] = month.split("-").map(Number);
    // Date handles the year rollover, so December + 1 becomes January.
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = new URLSearchParams(params.toString());
    next.set("month", `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const btn =
    "flex size-9 items-center justify-center rounded-[10px] border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={!canGoBack}
        aria-label="Previous month"
        className={btn}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      <span className="min-w-[8.5rem] text-center text-sm font-semibold tracking-tight">
        {label}
      </span>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={!canGoForward}
        aria-label="Next month"
        className={btn}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

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
 *
 * The control carries NO month label of its own — the page prints the month
 * once, as its heading, and a second copy inside the arrows is the duplication
 * the owner objected to. What it adds instead is "This month", the escape
 * hatch from three taps back to today; it is absent, not disabled, while you
 * are already there, because a control that exists only to refuse you is
 * noise.
 */
export function MonthPicker({
  month,
  isCurrent,
  canGoBack,
  canGoForward,
}: {
  /** YYYY-MM */
  month: string;
  /** Hides "This month" — there is nowhere to go. */
  isCurrent: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function goTo(next: string) {
    const q = new URLSearchParams(params.toString());
    q.set("month", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  function step(delta: number) {
    const [y, m] = month.split("-").map(Number);
    // Date handles the year rollover, so December + 1 becomes January.
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    goTo(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  function goCurrent() {
    const n = new Date();
    goTo(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
  }

  const arrow =
    "flex size-[38px] items-center justify-center bg-card text-secondary-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isCurrent ? null : (
        <button
          type="button"
          onClick={goCurrent}
          className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          This month
        </button>
      )}

      {/* One joined control rather than two loose buttons: the arrows are a
          pair, and a shared border says so. */}
      <div className="flex overflow-hidden rounded-[10px] border border-border">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className={`${arrow} border-r border-border`}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canGoForward}
          aria-label="Next month"
          className={arrow}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

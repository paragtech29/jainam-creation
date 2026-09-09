"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SimpleSelect } from "@/components/ui/simple-select";

/**
 * Which month the dashboard is showing.
 *
 * The month lives in the URL (`?month=YYYY-MM`), unlike the record dialogs
 * which deliberately do not: a month is a VIEW, so it should survive a
 * refresh, be shareable, and let the back button step through the months you
 * looked at. A dialog is a moment, not a view.
 *
 * MONTH AND YEAR ARE PICKED DIRECTLY, not stepped to. With arrows alone,
 * January 2026 was nine clicks from September and January 2025 was
 * twenty-one — which is how the owner came to believe last year's job works
 * had never been seeded. They had; they were simply out of reach. The arrows
 * stay for nudging one month at a time, but they are no longer the only way.
 *
 * The selects also NAME the month, so the page heading does not have to —
 * keeping to the rule that the month is named once on this screen.
 */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function MonthPicker({
  month,
  isCurrent,
  canGoBack,
  canGoForward,
  years,
  currentMonth,
}: {
  /** YYYY-MM */
  month: string;
  /** Hides "This month" — there is nowhere to go. */
  isCurrent: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Newest first, from the first job work to this year. */
  years: string[];
  /** YYYY-MM of today, so the future can be kept out of reach. */
  currentMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [selectedYear, selectedMonth] = month.split("-");
  const [thisYear, thisMonthNo] = currentMonth.split("-");

  function goTo(next: string) {
    const q = new URLSearchParams(params.toString());
    q.set("month", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  function step(delta: number) {
    const [y, m] = month.split("-").map(Number);
    // Date handles the year rollover, so December + 1 becomes January.
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    goTo(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }

  // A future month holds nothing and cannot, so it is not offered at all —
  // an option that leads to a guaranteed empty screen is worse than its
  // absence. Only the current year is capped; past years get all twelve.
  const monthCap = selectedYear === thisYear ? Number(thisMonthNo) : 12;
  const monthOptions = MONTH_NAMES.slice(0, monthCap).map((label, i) => ({
    value: pad(i + 1),
    label,
  }));

  function pickMonth(m: string) {
    goTo(`${selectedYear}-${m}`);
  }

  function pickYear(y: string) {
    // Changing 2025 → 2026 in December would ask for a month that has not
    // happened. Clamp rather than refuse: he asked for a year, and the newest
    // month he can actually see in it is the honest answer.
    const cap = y === thisYear ? Number(thisMonthNo) : 12;
    const m = Math.min(Number(selectedMonth), cap);
    goTo(`${y}-${pad(m)}`);
  }

  const arrow =
    "flex size-[38px] items-center justify-center bg-card text-secondary-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isCurrent ? null : (
        <button
          type="button"
          onClick={() => goTo(currentMonth)}
          className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          This month
        </button>
      )}

      <SimpleSelect
        value={selectedMonth}
        onValueChange={pickMonth}
        ariaLabel="Month"
        className="h-[38px] w-[140px]"
        options={monthOptions}
      />

      <SimpleSelect
        value={selectedYear}
        onValueChange={pickYear}
        ariaLabel="Year"
        className="h-[38px] w-[98px]"
        options={years.map((y) => ({ value: y, label: y }))}
      />

      {/* One joined control rather than two loose buttons: the arrows are a
          pair, and a shared border says so. They remain for nudging by one. */}
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

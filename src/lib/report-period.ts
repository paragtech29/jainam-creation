import type { ReportGroupBy } from "@/lib/db/repositories/jobWorks";

/**
 * What a report is looking at: a date range and a grouping, both read from the
 * query string.
 *
 * This lives on its own because the PAGE and the EXPORT ROUTE both parse it.
 * The export must describe exactly what is on screen — the same lesson the job
 * work export learned: one description of "the current view", read by
 * everything that renders it. A second copy of this parsing would eventually
 * disagree by a day.
 */
export type ReportPeriod = "month" | "year" | "custom";

export type ReportView = {
  period: ReportPeriod;
  groupBy: ReportGroupBy;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  /** "September 2026", "2026", or "12 Aug 2026 – 09 Sep 2026". */
  label: string;
  /** The raw month/year the pickers need back. */
  month: string;
  year: string;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, "0");

export function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}

export function currentYear() {
  return String(new Date().getFullYear());
}

/** Day 0 of the next month is the last day of this one, so leap years look after themselves. */
function lastDayOfMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function monthName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Anything malformed falls back to the current month rather than throwing —
 * a hand-edited URL should not be able to show an error page, and a report of
 * "this month" is the answer he wanted nine times out of ten anyway.
 */
export function readReportView(sp: {
  period?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  groupBy?: string;
}): ReportView {
  const groupBy: ReportGroupBy =
    sp.groupBy === "karigar" || sp.groupBy === "month" || sp.groupBy === "none"
      ? sp.groupBy
      : "party";

  const period: ReportPeriod =
    sp.period === "year" || sp.period === "custom" ? sp.period : "month";

  const month = MONTH_RE.test(sp.month ?? "") ? sp.month! : currentMonth();
  const year = YEAR_RE.test(sp.year ?? "") ? sp.year! : currentYear();

  if (period === "year") {
    return {
      period,
      groupBy,
      month,
      year,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: year,
    };
  }

  if (period === "custom") {
    const from = DATE_RE.test(sp.from ?? "") ? sp.from! : `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const to = DATE_RE.test(sp.to ?? "") ? sp.to! : `${month}-${pad(lastDayOfMonth(y, m))}`;
    // A backwards range would silently return nothing, which reads as "no
    // work" rather than "you have the dates the wrong way round".
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    return {
      period,
      groupBy,
      month,
      year,
      from: lo,
      to: hi,
      label: `${prettyDate(lo)} – ${prettyDate(hi)}`,
    };
  }

  const [y, m] = month.split("-").map(Number);
  return {
    period,
    groupBy,
    month,
    year,
    from: `${month}-01`,
    to: `${month}-${pad(lastDayOfMonth(y, m))}`,
    label: monthName(month),
  };
}

export const GROUP_LABELS: Record<ReportGroupBy, string> = {
  party: "By party",
  karigar: "By silai karigar",
  month: "By month",
  none: "Everything together",
};

/** The column heading for the grouped column. */
export const GROUP_COLUMN: Record<ReportGroupBy, string> = {
  party: "Party",
  karigar: "Silai karigar",
  month: "Month",
  none: "All work",
};

import Link from "next/link";
import { ClipboardList, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/session";
import {
  listJobWorksPage,
  getMonthSummary,
  getJobWorkDateRange,
} from "@/lib/db/repositories/jobWorks";
import { StatusBadge } from "@/components/status-badge";
import { MonthPicker } from "./month-picker";
import { PanelEmpty } from "./panel-empty";

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

/** "2026-08" -> { from: "2026-08-01", to: "2026-08-31", label: "August 2026" } */
function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // Day 0 of the NEXT month is the last day of this one, so February and the
  // leap years take care of themselves.
  const last = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(first),
    to: iso(last),
    label: first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

/** "2026-09" -> "2026-08", rolling the year over. */
function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function thisMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();

  // A malformed ?month simply falls back to now, rather than throwing.
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : thisMonth();
  const { from, to, label } = monthBounds(month);

  // The month BEFORE the selected one — not "last month" in absolute terms.
  // Stepping back to July must compare July with June, or the comparison is
  // quietly about a different pair of months than the one on screen.
  const prev = previousMonth(month);
  const prevBounds = monthBounds(prev);
  const year = month.slice(0, 4);

  const [summary, prevSummary, yearSummary, range, recentPage] = await Promise.all([
    getMonthSummary(userId, from, to),
    getMonthSummary(userId, prevBounds.from, prevBounds.to),
    getMonthSummary(userId, `${year}-01-01`, `${year}-12-31`),
    getJobWorkDateRange(userId),
    // Five, at the owner's request. "Recent" is a glance, not a list — the
    // full register is one tap away under Job Work.
    //
    // Scoped to the SELECTED MONTH, like every other figure on this screen.
    // It was not, and that only became visible once the month could be jumped
    // to directly: viewing January 2025 showed September 2026 rows beside
    // tiles reading January 2025. One screen, one time window.
    listJobWorksPage(userId, { page: 1, pageSize: 5, from, to }),
  ]);

  // Stop the picker wandering into empty years in either direction. Forward
  // is capped at the current month even when a job work is dated ahead.
  const firstYear = Number((range.first ?? `${thisMonth()}-01`).slice(0, 4));
  const thisYearNo = Number(thisMonth().slice(0, 4));
  const years: string[] = [];
  for (let y = thisYearNo; y >= Math.min(firstYear, thisYearNo); y--) years.push(String(y));

  const earliest = (range.first ?? thisMonth() + "-01").slice(0, 7);
  const latest = [range.last?.slice(0, 7), thisMonth()].filter(Boolean).sort().pop()!;
  const canGoBack = month > earliest;
  const canGoForward = month < latest;

  const recent = recentPage.rows;

  // The owner's asked-for breakup: what is still to do, what is finished but
  // not invoiced, and what has been billed — as AMOUNTS, since "how much" is
  // the question. Every figure is for the SELECTED month.
  // Earned is the answer to "how did the month go", so it is the one figure
  // that does not have to compete: it gets the dark tile. The other three are
  // its parts, and each carries the dot of the status it counts — the same
  // four hues the job work list uses, so a colour means one thing everywhere.
  const earned = {
    value: inr(summary.total),
    note: `${summary.count} job ${summary.count === 1 ? "work" : "works"} this month`,
  };

  // "Is this a good month?" is the question a bare figure cannot answer.
  // A percentage needs something to divide by, so with no previous month the
  // comparison is simply absent rather than shown as an infinite rise.
  const prevLabel = monthBounds(prev).label;
  const change =
    prevSummary.total > 0
      ? Math.round(((summary.total - prevSummary.total) / prevSummary.total) * 100)
      : null;
  const tiles = [
    {
      label: "Pending",
      value: inr(summary.pendingTotal + summary.inProgressTotal),
      note: "not finished yet",
      dot: "bg-status-pending",
    },
    {
      label: "To invoice",
      value: inr(summary.toInvoiceTotal),
      note: "completed, not billed",
      dot: "bg-status-progress",
      warn: summary.toInvoiceTotal > 0,
    },
    {
      label: "Billed",
      value: inr(summary.billedTotal),
      note: "already invoiced",
      dot: "bg-status-billed",
    },
  ];

  const biggest = summary.byParty[0]?.total ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4">
      {/* The month is named ONCE, by the picker's own selects. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* No heading: the month and year selects name the month, and naming
            it twice on one row is what the owner objected to before. */}
        <MonthPicker
          month={month}
          isCurrent={month === thisMonth()}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          years={years}
          currentMonth={thisMonth()}
        />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] xl:[grid-template-columns:repeat(4,minmax(0,1fr))]">
        <div className="flex flex-col gap-2.5 rounded-[15px] bg-sidebar p-[17px_18px]">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-sidebar-meta">
            Earned
          </span>
          <span className="text-[33px] font-bold leading-none tracking-[-0.035em] tabular-nums text-white">
            {earned.value}
          </span>
          <span className="text-xs text-sidebar-meta">{earned.note}</span>
          {change !== null ? (
            <span
              className={cn(
                "text-xs font-medium",
                change > 0 ? "text-status-completed" : change < 0 ? "text-status-pending" : "text-sidebar-meta"
              )}
            >
              {change > 0 ? "▲" : change < 0 ? "▼" : "="} {Math.abs(change)}% vs {prevLabel}
            </span>
          ) : null}
        </div>

        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-2.5 rounded-[15px] border border-border bg-card p-[17px_18px]"
          >
            <span className="flex items-center gap-[7px]">
              <span className={`size-[7px] shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
              <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
                {t.label}
              </span>
            </span>
            <span className="text-[33px] font-bold leading-none tracking-[-0.035em] tabular-nums">
              {t.value}
            </span>
            <span className={t.warn ? "text-xs font-medium text-status-pending" : "text-xs text-muted-foreground"}>
              {t.note}
            </span>
          </div>
        ))}
      </div>

      {/* The year, on its own line BELOW the month tiles rather than beside
          them. A year figure sitting in that row would put two time windows
          in one rank of tiles — the confusion this dashboard already had once,
          when some tiles were all-time while the headline said this month. */}
      <Link
        href={`/reports?period=year&year=${year}&groupBy=party`}
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-[12px] border border-border bg-card px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13px] text-muted-foreground">
          {year} so far
          <span className="ml-2 font-mono text-[15px] font-bold tabular-nums text-foreground">
            {inr(yearSummary.total)}
          </span>
        </span>
        <span className="text-[12.5px] text-muted-foreground">
          {yearSummary.count} job {yearSummary.count === 1 ? "work" : "works"} · see the full report →
        </span>
      </Link>

      <div className="grid items-stretch gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))] xl:[grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
            <span className="text-[14.5px] font-semibold tracking-tight">Recent job work</span>
            <Link href="/job-work" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <PanelEmpty
              icon={<ClipboardList size={21} aria-hidden="true" />}
              title="Nothing recorded yet"
              body="Job works you take from a party will show up here."
              action={{ label: "Record job work", href: "/job-work/new" }}
            />
          ) : (
            recent.map((r) => (
              <Link
                key={r.id}
                href={`/job-work/${r.id}`}
                className="flex items-center gap-3 border-b border-border px-[18px] py-3 transition-colors last:border-0 hover:bg-muted/40"
              >
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-xs font-semibold text-accent-foreground">
                  {r.partyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13.5px] font-medium">
                    {r.partyName} · {r.karigarName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.pieces} pcs · {inr(r.total)}
                  </span>
                </div>
                {/* The same pill the job work list uses. Where a row is going
                    matters more at a glance than what it is worth — the money
                    is already totalled in the tiles above. */}
                <StatusBadge status={r.status} isBilled={r.isBilled} />
              </Link>
            ))
          )}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
            {/* No month label here either: the picker names it once for the
                whole screen. The empty-state sentence below still says the
                month, because there it is a statement rather than a label —
                "nothing in THIS month" is the useful part. */}
            <span className="text-[14.5px] font-semibold tracking-tight">Work by party</span>
          </div>

          {summary.byParty.length === 0 ? (
            <PanelEmpty
              icon={<Building2 size={21} aria-hidden="true" />}
              title={`No party work in ${label}`}
              body="Once job works are recorded, each party's share appears here."
            />
          ) : (
            <div className="py-2">
              {/* Each row lands on the job work list already filtered to this
                  party AND this month — the figure and the rows behind it are
                  never a re-derivation the owner has to trust. */}
              {summary.byParty.map((p) => (
                <Link
                  key={p.partyId}
                  href={`/job-work?from=${from}&to=${to}&party=${p.partyId}`}
                  className="flex flex-col gap-[7px] px-[18px] py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium">{p.partyName}</span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-secondary-foreground">
                      {inr(p.total)}
                    </span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: biggest > 0 ? `${Math.max(4, (p.total / biggest) * 100)}%` : "0%" }}
                    />
                  </div>
                  {/* The bar is relative to the BIGGEST party, so it answers
                      "who is my largest" at a glance. The percentage is of the
                      whole month, which is the different — and more useful —
                      question of how much of the month this one party was. */}
                  <span className="text-[11.5px] text-muted-foreground">
                    {p.count} job {p.count === 1 ? "work" : "works"}
                    {summary.total > 0
                      ? ` · ${Math.round((p.total / summary.total) * 100)}% of the month`
                      : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

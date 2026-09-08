import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import {
  listJobWorksPage,
  getMonthSummary,
  getJobWorkDateRange,
} from "@/lib/db/repositories/jobWorks";
import { MonthPicker } from "./month-picker";

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

  const [summary, range, recentPage] = await Promise.all([
    getMonthSummary(userId, from, to),
    getJobWorkDateRange(userId),
    listJobWorksPage(userId, { page: 1, pageSize: 6 }),
  ]);

  // Stop the picker wandering into empty years in either direction. Forward
  // is capped at the current month even when a job work is dated ahead.
  const earliest = (range.first ?? thisMonth() + "-01").slice(0, 7);
  const latest = [range.last?.slice(0, 7), thisMonth()].filter(Boolean).sort().pop()!;
  const canGoBack = month > earliest;
  const canGoForward = month < latest;

  const recent = recentPage.rows;

  // The owner's asked-for breakup: what is still to do, what is finished but
  // not invoiced, and what has been billed — as AMOUNTS, since "how much" is
  // the question. Every figure is for the SELECTED month.
  const tiles = [
    { label: "Earned", value: inr(summary.total), note: `${summary.count} job ${summary.count === 1 ? "work" : "works"}` },
    { label: "Pending", value: inr(summary.pendingTotal + summary.inProgressTotal), note: "not finished yet" },
    {
      label: "To invoice",
      value: inr(summary.toInvoiceTotal),
      note: "completed, not billed",
      warn: summary.toInvoiceTotal > 0,
    },
    { label: "Billed", value: inr(summary.billedTotal), note: "already invoiced" },
  ];

  const biggest = summary.byParty[0]?.total ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4">
      {/* The picker is the ONLY place the month is named. It used to be
          repeated in a heading to the left of this row, with a subtitle
          explaining what the picker beside it already made obvious. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <MonthPicker month={month} label={label} canGoBack={canGoBack} canGoForward={canGoForward} />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(186px,1fr))]">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-[15px_17px]"
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
              {t.label}
            </span>
            <span className="text-[29px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {t.value}
            </span>
            <span className={t.warn ? "text-xs font-medium text-status-pending" : "text-xs text-muted-foreground"}>
              {t.note}
            </span>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
            <span className="text-[14.5px] font-semibold tracking-tight">Recent job work</span>
            <Link href="/job-work" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">
              Nothing recorded yet.{" "}
              <Link href="/job-work/new" className="font-medium text-primary hover:underline">
                Add your first job work
              </Link>
              .
            </p>
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
                  <span className="truncate text-[13.5px] font-medium">{r.partyName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.karigarName} · {r.pieces} × ₹{r.rate}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[13px] tabular-nums">{inr(r.total)}</span>
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
            <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">
              No job works in {label}.
            </p>
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
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: biggest > 0 ? `${Math.max(4, (p.total / biggest) * 100)}%` : "0%" }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

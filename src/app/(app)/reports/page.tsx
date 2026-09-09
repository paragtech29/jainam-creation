import { BarChart3 } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { getReportRows, getJobWorkDateRange } from "@/lib/db/repositories/jobWorks";
import { readReportView, GROUP_COLUMN, currentYear } from "@/lib/report-period";
import { EmptyState } from "@/components/empty-state";
import { ReportControls } from "./report-controls";
import { ReportExportMenu } from "./report-export-menu";

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * The report the owner asked for: "this month, this party gave me this much",
 * and the same question for a year, or for everyone together.
 *
 * Four reports were requested — monthly all, monthly per party, yearly all,
 * yearly per party — but they are two choices, not four screens: a PERIOD and
 * a GROUPING. Building it that way also answered "by karigar" and "by month
 * within a year" for nothing.
 *
 * Every figure is summed in SQL over the whole range, never over a page of
 * rows. The job work list's footer total answers "what is in front of me",
 * which stops being a useful answer as the register grows — that is precisely
 * what prompted this screen.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }>;
}) {
  const sp = await searchParams;
  const view = readReportView(sp);
  const userId = await getCurrentUserId();

  const [rows, range] = await Promise.all([
    getReportRows(userId, { from: view.from, to: view.to, groupBy: view.groupBy }),
    getJobWorkDateRange(userId),
  ]);

  // Years he could plausibly ask for: from his first job work to this one.
  const firstYear = Number((range.first ?? `${currentYear()}-01-01`).slice(0, 4));
  const thisYear = Number(currentYear());
  const years: string[] = [];
  for (let y = thisYear; y >= Math.min(firstYear, thisYear); y--) years.push(String(y));

  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + r.count,
      pieces: a.pieces + r.pieces,
      total: a.total + r.total,
      billed: a.billed + r.billed,
      toInvoice: a.toInvoice + r.toInvoice,
      pending: a.pending + r.pending,
    }),
    { count: 0, pieces: 0, total: 0, billed: 0, toInvoice: 0, pending: 0 }
  );

  const qs = new URLSearchParams({
    period: view.period,
    groupBy: view.groupBy,
    month: view.month,
    year: view.year,
    from: view.from,
    to: view.to,
  }).toString();

  const empty = totals.count === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportControls view={view} years={years} />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold leading-none tracking-[-0.02em]">{view.label}</h2>

        {/* Excel or PDF, both handed the SAME query string this page read, so
            neither can describe a different period from the one on screen. */}
        <ReportExportMenu qs={qs} rowCount={rows.length} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState
            icon={BarChart3}
            title={`No job work in ${view.label}`}
            description="Change the period above, or record a job work and it will appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left">
                  <th className="h-11 px-4 font-medium text-muted-foreground">
                    {GROUP_COLUMN[view.groupBy]}
                  </th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">Job works</th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">Pieces</th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">Pending</th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">To invoice</th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">Billed</th>
                  <th className="h-11 px-4 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="h-12 px-4 font-medium">{r.label}</td>
                    <td className="tnum px-4 text-right text-muted-foreground">{r.count}</td>
                    <td className="tnum px-4 text-right text-muted-foreground">
                      {r.pieces.toLocaleString("en-IN")}
                    </td>
                    <td className="tnum px-4 text-right text-muted-foreground">{inr(r.pending)}</td>
                    <td className="tnum px-4 text-right text-muted-foreground">{inr(r.toInvoice)}</td>
                    <td className="tnum px-4 text-right text-muted-foreground">{inr(r.billed)}</td>
                    <td className="tnum px-4 text-right font-semibold">{inr(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              {/* The grand total is the sum of the rows above it, not a second
                  query — so the table can never fail to add up to its own
                  footer. */}
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td className="h-12 px-4 font-semibold">Total</td>
                  <td className="tnum px-4 text-right font-medium">{totals.count}</td>
                  <td className="tnum px-4 text-right font-medium">
                    {totals.pieces.toLocaleString("en-IN")}
                  </td>
                  <td className="tnum px-4 text-right font-medium">{inr(totals.pending)}</td>
                  <td className="tnum px-4 text-right font-medium">{inr(totals.toInvoice)}</td>
                  <td className="tnum px-4 text-right font-medium">{inr(totals.billed)}</td>
                  <td className="tnum px-4 text-right text-base font-bold">{inr(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

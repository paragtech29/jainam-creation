import { getCurrentUserId } from "@/lib/session";
import { getReportRows } from "@/lib/db/repositories/jobWorks";
import { readReportView, GROUP_COLUMN, GROUP_LABELS } from "@/lib/report-period";
import { PrintTrigger } from "../../job-work/print/print-trigger";

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

/**
 * The report, laid out for paper — which is how it becomes a PDF.
 *
 * Same choice as the job work print page: the browser's own print-to-PDF
 * rather than a server-generated file, because built-in PDF fonts have no ₹
 * glyph and shipping a font raised a licence question. Printing renders ₹ with
 * the device's own fonts and embeds nothing.
 *
 * It reads the SAME query string the report page read, through the same
 * `readReportView`, so a printed report cannot show a different period from
 * the screen it was launched from.
 */
export default async function ReportPrintPage({
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

  const rows = await getReportRows(userId, {
    from: view.from,
    to: view.to,
    groupBy: view.groupBy,
  });

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

  const th = "border-b border-black/25 px-2 py-1.5 text-right font-semibold";
  const td = "border-b border-black/10 px-2 py-1.5 text-right tabular-nums";

  return (
    <div className="bg-white text-black">
      <PrintTrigger />

      <div className="mx-auto max-w-[1000px] px-6 py-4">
        <div className="mb-4 flex items-baseline justify-between gap-4 border-b-2 border-black/70 pb-2">
          <div>
            <h1 className="text-xl font-bold">Jainam Creation</h1>
            <p className="text-[13px]">
              {view.label} · {GROUP_LABELS[view.groupBy]}
            </p>
          </div>
          <p className="text-[12px]">
            {totals.count} job {totals.count === 1 ? "work" : "works"} ·{" "}
            {totals.pieces.toLocaleString("en-IN")} pieces
          </p>
        </div>

        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${th} text-left`}>{GROUP_COLUMN[view.groupBy]}</th>
              <th className={th}>Job works</th>
              <th className={th}>Pieces</th>
              <th className={th}>Pending</th>
              <th className={th}>To invoice</th>
              <th className={th}>Billed</th>
              <th className={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={`${td} text-left`}>{r.label}</td>
                <td className={td}>{r.count}</td>
                <td className={td}>{r.pieces.toLocaleString("en-IN")}</td>
                <td className={td}>{inr(r.pending)}</td>
                <td className={td}>{inr(r.toInvoice)}</td>
                <td className={td}>{inr(r.billed)}</td>
                <td className={`${td} font-semibold`}>{inr(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {/* Summed from the rows printed above, never queried again — a paper
              total that disagrees with the column above it is the one thing a
              report must never do. */}
          <tfoot>
            <tr className="font-bold">
              <td className="border-t-2 border-black/70 px-2 py-2 text-left">Total</td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {totals.count}
              </td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {totals.pieces.toLocaleString("en-IN")}
              </td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {inr(totals.pending)}
              </td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {inr(totals.toInvoice)}
              </td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {inr(totals.billed)}
              </td>
              <td className="border-t-2 border-black/70 px-2 py-2 text-right tabular-nums">
                {inr(totals.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4 text-[11px] text-black/60">
          Printed {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

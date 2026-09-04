import { getCurrentUserId } from "@/lib/session";
import { listJobWorksForExport } from "@/lib/db/repositories/jobWorks";
import { getPartyById } from "@/lib/db/repositories/parties";
import { getKarigarById } from "@/lib/db/repositories/karigars";
import { describeFilters } from "@/lib/export/job-works-workbook";
import { PrintTrigger } from "./print-trigger";

/**
 * The PDF, produced by the browser's own print-to-PDF.
 *
 * Deliberately NOT a server-generated PDF. The built-in PDF fonts have no ₹
 * glyph, so a server PDF needs a font file shipped in the repo — and where
 * Next bundles a suitable one (Geist, which does contain U+20B9) the licence
 * is not stated alongside it. Printing from the browser renders ₹ with the
 * device's own fonts, adds no dependency, and ships no font. The owner chose
 * this over the alternatives.
 *
 * Everything is inline-styled or in a print stylesheet, because the app
 * chrome — sidebar, header, buttons — must not appear on paper.
 */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export default async function JobWorkPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    party?: string;
    karigar?: string;
    status?: string;
    billed?: string;
  }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();

  const billed: "yes" | "no" | undefined =
    sp.billed === "yes" || sp.billed === "no" ? sp.billed : undefined;

  const filters = {
    search: sp.q,
    from: sp.from,
    to: sp.to,
    partyId: sp.party,
    karigarId: sp.karigar,
    status: sp.status,
    billed,
  };

  const [{ rows, grandTotal }, party, karigar] = await Promise.all([
    listJobWorksForExport(userId, filters),
    sp.party ? getPartyById(userId, sp.party) : null,
    sp.karigar ? getKarigarById(userId, sp.karigar) : null,
  ]);

  const filterLine = describeFilters({
    from: sp.from,
    to: sp.to,
    partyName: party?.name,
    karigarName: karigar?.name,
    status: sp.status,
    billed,
    search: sp.q,
  });

  const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

  return (
    <div className="print-sheet min-h-0 flex-1 overflow-y-auto">
      <PrintTrigger />

      <div className="mx-auto max-w-[1000px] p-6 print:p-0">
        <header className="mb-4 border-b border-border pb-3">
          <h1 className="font-heading text-xl font-bold tracking-tight">
            Jainam Creation — Job Work
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{filterLine}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {rows.length} {rows.length === 1 ? "entry" : "entries"} · printed{" "}
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing to print for these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="py-1.5 pr-2 font-semibold">Date</th>
                <th className="py-1.5 pr-2 font-semibold">Chalan</th>
                <th className="py-1.5 pr-2 font-semibold">Party</th>
                <th className="py-1.5 pr-2 font-semibold">Karigar</th>
                <th className="py-1.5 pr-2 font-semibold">P.D.No.</th>
                <th className="py-1.5 pr-2 font-semibold">C.D.No.</th>
                <th className="py-1.5 pr-2 font-semibold">Particulars</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Pcs</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Rate</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{r.date}</td>
                  <td className="py-1.5 pr-2">{r.chalanNo ?? "—"}</td>
                  <td className="py-1.5 pr-2">{r.partyName}</td>
                  <td className="py-1.5 pr-2">{r.karigarName}</td>
                  <td className="py-1.5 pr-2">{r.partyDesignNo ?? "—"}</td>
                  <td className="py-1.5 pr-2">{r.computerDesignNo ?? "—"}</td>
                  <td className="py-1.5 pr-2">{r.particulars || "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.pieces}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{inr(r.rate)}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{inr(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground font-bold">
                <td className="py-2 pr-2" colSpan={9}>
                  Grand total
                </td>
                <td className="py-2 text-right tabular-nums">{inr(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <p className="mt-4 text-[10.5px] text-muted-foreground print:hidden">
          Use your browser&apos;s print dialog and choose <strong>Save as PDF</strong>.
          {" "}
          {STATUS_LABEL[sp.status ?? ""] ? `Status filter: ${STATUS_LABEL[sp.status!]}.` : ""}
        </p>
      </div>
    </div>
  );
}

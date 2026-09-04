import { getCurrentUserId } from "@/lib/session";
import { listJobWorksForExport } from "@/lib/db/repositories/jobWorks";
import { getPartyById } from "@/lib/db/repositories/parties";
import { getKarigarById } from "@/lib/db/repositories/karigars";
import { buildJobWorksWorkbook, describeFilters } from "@/lib/export/job-works-workbook";

/**
 * Downloads the CURRENT job work view as .xlsx.
 *
 * The filters arrive as the same query parameters the list page reads, so the
 * file always matches the screen it was launched from — there is no second
 * definition of "the filtered view" to drift out of step.
 *
 * A route handler rather than a Server Action because this returns a FILE.
 * Actions return values to React; a download needs real response headers.
 */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const q = new URL(request.url).searchParams;
  const billedRaw = q.get("billed");
  const billed: "yes" | "no" | undefined =
    billedRaw === "yes" || billedRaw === "no" ? billedRaw : undefined;

  const filters = {
    search: q.get("q") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    partyId: q.get("party") ?? undefined,
    karigarId: q.get("karigar") ?? undefined,
    status: q.get("status") ?? undefined,
    billed,
  };

  const { rows, grandTotal } = await listJobWorksForExport(userId, filters);

  // Names, not ids, in the header line — an id in a saved spreadsheet tells
  // the owner nothing six months from now.
  const [party, karigar] = await Promise.all([
    filters.partyId ? getPartyById(userId, filters.partyId) : null,
    filters.karigarId ? getKarigarById(userId, filters.karigarId) : null,
  ]);

  const filterLine = describeFilters({
    from: filters.from,
    to: filters.to,
    partyName: party?.name,
    karigarName: karigar?.name,
    status: filters.status,
    billed: filters.billed,
    search: filters.search,
  });

  const buffer = await buildJobWorksWorkbook(rows, grandTotal, filterLine);

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `jainam-job-work-${stamp}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(buffer.byteLength),
      // Never cached: the next export must reflect the data as it is then.
      "Cache-Control": "no-store",
    },
  });
}

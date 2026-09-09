import { getCurrentUserId } from "@/lib/session";
import { getReportRows } from "@/lib/db/repositories/jobWorks";
import { readReportView, GROUP_COLUMN, GROUP_LABELS } from "@/lib/report-period";
import { buildReportWorkbook } from "@/lib/export/report-workbook";

/**
 * Downloads the summary report as .xlsx.
 *
 * It parses the query string with the SAME `readReportView` the page uses, so
 * the file describes exactly the period and grouping on screen. That is the
 * rule the job work export established and it matters more here: a report
 * whose header says September while its figures are August is worse than no
 * report at all.
 *
 * A route handler rather than a Server Action, because this returns a FILE —
 * actions return values to React; a download needs real response headers.
 */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    // 404 rather than 403, like /api/images: it should not confirm what
    // exists to someone who is not signed in.
    return new Response("Not found", { status: 404 });
  }

  const q = new URL(request.url).searchParams;
  const view = readReportView({
    period: q.get("period") ?? undefined,
    month: q.get("month") ?? undefined,
    year: q.get("year") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    groupBy: q.get("groupBy") ?? undefined,
  });

  const rows = await getReportRows(userId, {
    from: view.from,
    to: view.to,
    groupBy: view.groupBy,
  });

  const buffer = await buildReportWorkbook(rows, {
    groupColumn: GROUP_COLUMN[view.groupBy],
    periodLabel: view.label,
    groupingLabel: GROUP_LABELS[view.groupBy],
  });

  // The period in the filename, so a folder of these is readable without
  // opening them: jainam-report-2026-09-by-party.xlsx
  const slug = view.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const name = `jainam-report-${slug}-${view.groupBy}.xlsx`;

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

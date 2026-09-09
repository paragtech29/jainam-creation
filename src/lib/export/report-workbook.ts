import ExcelJS from "exceljs";
import type { ReportRow } from "@/lib/db/repositories/jobWorks";

/**
 * The summary report as .xlsx — one line per party (or karigar, or month),
 * with a grand total at the foot.
 *
 * Deliberately NOT the row-by-row export. That one answers "which chalans";
 * this one answers "how much", which is the question the owner actually asked:
 * "this month, this party gave me this much work". A report he can read on a
 * phone is worth more than one he has to scroll.
 *
 * Same conventions as the job work export, so the two files feel like they
 * came from the same book: ExcelJS (never xlsx/SheetJS — unpatched
 * advisories), a title and a context line above the table, brand-teal header,
 * and figures written as NUMBERS so re-summing a column in Excel gives the
 * same answer the app gives.
 */

const BRAND = "FF0E7168";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });
}

export async function buildReportWorkbook(
  rows: ReportRow[],
  opts: { groupColumn: string; periodLabel: string; groupingLabel: string }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jainam Creation";
  wb.created = new Date();

  const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 3 }] });

  const HEADERS = [
    { header: opts.groupColumn, key: "label", width: 26 },
    { header: "Job works", key: "count", width: 11 },
    { header: "Pieces", key: "pieces", width: 11 },
    { header: "Pending", key: "pending", width: 14 },
    { header: "To invoice", key: "toInvoice", width: 14 },
    { header: "Billed", key: "billed", width: 14 },
    { header: "Total", key: "total", width: 15 },
  ];

  ws.mergeCells(1, 1, 1, HEADERS.length);
  const title = ws.getCell("A1");
  title.value = "Jainam Creation — Report";
  title.font = { bold: true, size: 14 };
  ws.getRow(1).height = 24;

  // The period and the grouping, spelled out. A saved file must still say what
  // it is when it turns up in WhatsApp months later.
  ws.mergeCells(2, 1, 2, HEADERS.length);
  const sub = ws.getCell("A2");
  sub.value = `${opts.periodLabel}  ·  ${opts.groupingLabel}`;
  sub.font = { size: 10, color: { argb: "FF666666" } };

  ws.columns = HEADERS.map((h) => ({ key: h.key, width: h.width }));
  styleHeader(ws.addRow(HEADERS.map((h) => h.header)));

  const money = '#,##0';
  for (const r of rows) {
    const row = ws.addRow({
      label: r.label,
      count: r.count,
      pieces: r.pieces,
      pending: r.pending,
      toInvoice: r.toInvoice,
      billed: r.billed,
      total: r.total,
    });
    for (const key of ["count", "pieces", "pending", "toInvoice", "billed", "total"]) {
      const cell = row.getCell(key);
      cell.alignment = { horizontal: "right" };
      cell.numFmt = money;
    }
  }

  // The grand total is summed from the rows written above, not queried again:
  // a footer that disagrees with the column above it is the one thing a report
  // must never do.
  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + r.count,
      pieces: a.pieces + r.pieces,
      pending: a.pending + r.pending,
      toInvoice: a.toInvoice + r.toInvoice,
      billed: a.billed + r.billed,
      total: a.total + r.total,
    }),
    { count: 0, pieces: 0, pending: 0, toInvoice: 0, billed: 0, total: 0 }
  );

  const totalRow = ws.addRow({ label: "Total", ...totals });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: "FF999999" } } };
  });
  for (const key of ["count", "pieces", "pending", "toInvoice", "billed", "total"]) {
    const cell = totalRow.getCell(key);
    cell.alignment = { horizontal: "right" };
    cell.numFmt = money;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

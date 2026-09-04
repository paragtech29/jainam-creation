import ExcelJS from "exceljs";
import type { JobWorkExportRow } from "@/lib/db/repositories/jobWorks";

/**
 * The job work export, laid out like the owner's register.
 *
 * Column order is his book's order, which is also the form's order: date,
 * chalan, the two design numbers, particulars, pieces, rate, total. The
 * grand total sits at the foot of the Total column, where he adds it up.
 *
 * ExcelJS rather than xlsx/SheetJS: SheetJS has unpatched advisories, and
 * this is a decision recorded early in the project — do not swap it back.
 */

const HEADERS = [
  { header: "Date", key: "date", width: 12 },
  { header: "Chalan No.", key: "chalanNo", width: 12 },
  { header: "Party", key: "partyName", width: 22 },
  { header: "Silai Karigar", key: "karigarName", width: 20 },
  { header: "Party D.No.", key: "partyDesignNo", width: 12 },
  { header: "Computer D.No.", key: "computerDesignNo", width: 15 },
  { header: "Particulars", key: "particulars", width: 26 },
  { header: "Pieces", key: "pieces", width: 9 },
  { header: "Rate", key: "rate", width: 10 },
  { header: "Total", key: "total", width: 13 },
  { header: "Status", key: "status", width: 13 },
  { header: "Billed", key: "billed", width: 8 },
  { header: "Comment", key: "comment", width: 30 },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

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

/** A human line describing what was filtered, so a saved file explains itself. */
export function describeFilters(f: {
  from?: string;
  to?: string;
  partyName?: string;
  karigarName?: string;
  status?: string;
  billed?: string;
  search?: string;
}): string {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`Dates ${f.from || "any"} to ${f.to || "any"}`);
  if (f.partyName) parts.push(`Party: ${f.partyName}`);
  if (f.karigarName) parts.push(`Karigar: ${f.karigarName}`);
  if (f.status) parts.push(`Status: ${STATUS_LABEL[f.status] ?? f.status}`);
  if (f.billed) parts.push(`Billed: ${f.billed === "yes" ? "Yes" : "No"}`);
  if (f.search) parts.push(`Search: "${f.search}"`);
  return parts.length ? parts.join("  ·  ") : "All job works";
}

export async function buildJobWorksWorkbook(
  rows: JobWorkExportRow[],
  grandTotal: number,
  filterLine: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jainam Creation";
  wb.created = new Date();

  const ws = wb.addWorksheet("Job Work", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  // Two lines of context above the table: whose book this is, and what slice
  // of it. A spreadsheet that lands in WhatsApp months later should still say
  // what it is.
  ws.mergeCells(1, 1, 1, HEADERS.length);
  const title = ws.getCell("A1");
  title.value = "Jainam Creation — Job Work";
  title.font = { bold: true, size: 14 };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, HEADERS.length);
  const sub = ws.getCell("A2");
  sub.value = filterLine;
  sub.font = { size: 10, color: { argb: "FF666666" } };

  ws.columns = HEADERS.map((h) => ({ key: h.key, width: h.width }));
  const head = ws.addRow(HEADERS.map((h) => h.header));
  styleHeader(head);

  for (const r of rows) {
    const row = ws.addRow({
      date: r.date,
      chalanNo: r.chalanNo ?? "",
      partyName: r.partyName,
      karigarName: r.karigarName,
      partyDesignNo: r.partyDesignNo ?? "",
      computerDesignNo: r.computerDesignNo ?? "",
      particulars: r.particulars,
      pieces: r.pieces,
      rate: r.rate,
      total: r.total,
      status: STATUS_LABEL[r.status] ?? r.status,
      billed: r.isBilled ? "Yes" : "No",
      comment: r.comment ?? "",
    });
    // Real numbers, not text: the owner should be able to re-sum a column in
    // Excel and get the same answer the app gives.
    for (const key of ["pieces", "rate", "total"]) {
      row.getCell(key).numFmt = key === "pieces" ? "0" : "#,##0";
    }
  }

  // The grand total, on the Total column, where he adds it up in the book.
  const totalRow = ws.addRow({ particulars: "Grand total", total: grandTotal });
  totalRow.font = { bold: true };
  totalRow.getCell("total").numFmt = "#,##0";
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: "double", color: { argb: "FF333333" } } };
  });

  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: HEADERS.length },
  };

  // ExcelJS types this as a Node Buffer in practice but declares ArrayBuffer.
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

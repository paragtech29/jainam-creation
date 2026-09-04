import ExcelJS from "exceljs";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars, listKarigarPartyLinks } from "@/lib/db/repositories/karigars";
import { listDescriptionTypes } from "@/lib/db/repositories/description-types";
import { listJobWorksForExport } from "@/lib/db/repositories/jobWorks";

/**
 * The whole dataset as one .xlsx — a sheet each for job works, parties,
 * karigars, their links, and description types.
 *
 * This doubles as the owner's backup. He has no database console and no
 * intention of learning one, so "one click, one file, everything in it" is
 * the only backup he will ever actually take. That is why it includes the
 * link rows too: parties and karigars alone would not let anyone reconstruct
 * who sews for whom.
 */
const BRAND = "FF0E7168";

function addSheet<T extends Record<string, unknown>>(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width: number }[],
  rows: T[]
) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.addRow(columns.map((c) => c.header));
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.height = 20;
  head.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

export async function GET() {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const [parties, karigars, links, types, jobs] = await Promise.all([
    listParties(userId),
    listKarigars(userId),
    listKarigarPartyLinks(userId),
    listDescriptionTypes(userId),
    listJobWorksForExport(userId),
  ]);

  const partyName = new Map(parties.map((p) => [p.id, p.name]));
  const karigarName = new Map(karigars.map((k) => [k.id, k.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Jainam Creation";
  wb.created = new Date();

  addSheet(
    wb,
    "Job Work",
    [
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
    ],
    jobs.rows.map((r) => ({
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
      status: r.status,
      billed: r.isBilled ? "Yes" : "No",
      comment: r.comment ?? "",
    }))
  );

  addSheet(
    wb,
    "Parties",
    [
      { header: "Party", key: "name", width: 24 },
      { header: "Owner", key: "ownerName1", width: 20 },
      { header: "Co-owner", key: "ownerName2", width: 20 },
      { header: "Mobile", key: "contact1", width: 16 },
      { header: "Alternate", key: "contact2", width: 16 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Email", key: "email", width: 24 },
      { header: "Address", key: "address", width: 34 },
      { header: "Archived", key: "archived", width: 10 },
    ],
    parties.map((p) => ({
      name: p.name,
      ownerName1: p.ownerName1,
      ownerName2: p.ownerName2 ?? "",
      contact1: p.contact1 ?? "",
      contact2: p.contact2 ?? "",
      gender: p.gender ?? "",
      email: p.email ?? "",
      address: p.address ?? "",
      archived: p.isArchived ? "Yes" : "No",
    }))
  );

  addSheet(
    wb,
    "Silai Karigars",
    [
      { header: "Karigar", key: "name", width: 24 },
      { header: "Mobile", key: "contact1", width: 16 },
      { header: "Alternate", key: "contact2", width: 16 },
      { header: "Address", key: "address", width: 34 },
      { header: "Archived", key: "archived", width: 10 },
    ],
    karigars.map((k) => ({
      name: k.name,
      contact1: k.contact1 ?? "",
      contact2: k.contact2 ?? "",
      address: k.address ?? "",
      archived: k.isArchived ? "Yes" : "No",
    }))
  );

  // Without this sheet the export could not rebuild who sews for whom.
  addSheet(
    wb,
    "Karigar Parties",
    [
      { header: "Karigar", key: "karigar", width: 24 },
      { header: "Party", key: "party", width: 24 },
    ],
    links.map((l) => ({
      karigar: karigarName.get(l.karigarId) ?? l.karigarId,
      party: partyName.get(l.partyId) ?? l.partyId,
    }))
  );

  addSheet(
    wb,
    "Description Types",
    [{ header: "Description", key: "name", width: 24 }],
    types.map((t) => ({ name: t.name }))
  );

  const out = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(out as ArrayBuffer);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jainam-creation-backup-${stamp}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

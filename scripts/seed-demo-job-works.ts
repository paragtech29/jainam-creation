// Twelve realistic job works, so the list, the filters, the pager and the
// dashboard all have something to work with.
//
//   npm run seed:demo           -> add them (skips any already there)
//   npm run seed:demo -- --wipe -> remove exactly these twelve
//
// Written at the owner's request. It uses HIS parties, karigars and work types
// rather than inventing "ZZ Test" ones, because the point is to test the app
// as it will really look — but every row carries a chalan number from a known
// block (9001–9012), which is how --wipe finds exactly these and nothing else.
//
// It respects the two rules the app enforces, so the seeded data could all
// have been typed by hand:
//   * a karigar is only used with a party they are actually linked to
//   * isBilled is only ever true on a COMPLETED job work
import "dotenv/config";
import { getUserByUsername } from "../src/lib/db/repositories/users";
import { listParties } from "../src/lib/db/repositories/parties";
import { listKarigars, listKarigarPartyLinks } from "../src/lib/db/repositories/karigars";
import { listDescriptionTypes } from "../src/lib/db/repositories/description-types";
import {
  createJobWork,
  listJobWorksPage,
  deleteJobWork,
} from "../src/lib/db/repositories/jobWorks";
import { computeTotal } from "../src/lib/validation/job-work";

const WIPE = process.argv.includes("--wipe");

type Row = {
  chalanNo: string;
  daysAgo: number;
  party: string;
  pieces: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  isBilled?: boolean;
  /** Work type names with the price charged for each. */
  work: [string, number][];
  partyDesignNo?: string;
  computerDesignNo?: string;
  comment?: string;
};

// Spread deliberately: about half in the current month and half in the one
// before, so the dashboard's month picker and the date filters both have two
// months to move between. Every status appears, and only COMPLETED rows are
// ever billed.
const ROWS: Row[] = [
  { chalanNo: "9001", daysAgo: 1, party: "Mayra Creation", pieces: 126, status: "PENDING", work: [["galu", 162]], partyDesignNo: "7170", computerDesignNo: "4402" },
  { chalanNo: "9002", daysAgo: 2, party: "Amba Creation", pieces: 240, status: "IN_PROGRESS", work: [["Sleevs", 95]], partyDesignNo: "2210" },
  { chalanNo: "9003", daysAgo: 4, party: "Mayra Creation", pieces: 60, status: "COMPLETED", work: [["galu", 150], ["Sleevs", 90]], partyDesignNo: "7171", computerDesignNo: "4410", comment: "Rush order, collected same evening" },
  { chalanNo: "9004", daysAgo: 6, party: "Amba Creation", pieces: 480, status: "COMPLETED", isBilled: true, work: [["Sleevs", 88]], partyDesignNo: "2214" },
  { chalanNo: "9005", daysAgo: 9, party: "Mayra Creation", pieces: 96, status: "IN_PROGRESS", work: [["galu", 175]], computerDesignNo: "4418" },
  { chalanNo: "9006", daysAgo: 12, party: "Amba Creation", pieces: 150, status: "COMPLETED", isBilled: true, work: [["galu", 140], ["Sleevs", 85]], partyDesignNo: "2219", comment: "Two colours" },
  { chalanNo: "9007", daysAgo: 15, party: "Mayra Creation", pieces: 320, status: "PENDING", work: [["Sleevs", 105]], partyDesignNo: "7180" },
  // ---- the month before ----
  { chalanNo: "9008", daysAgo: 26, party: "Amba Creation", pieces: 210, status: "COMPLETED", isBilled: true, work: [["galu", 158]], partyDesignNo: "2225", computerDesignNo: "4431" },
  { chalanNo: "9009", daysAgo: 31, party: "Mayra Creation", pieces: 112, status: "COMPLETED", isBilled: true, work: [["galu", 198]], partyDesignNo: "7186" },
  { chalanNo: "9010", daysAgo: 36, party: "Amba Creation", pieces: 459, status: "COMPLETED", work: [["Sleevs", 155]], partyDesignNo: "2231", comment: "Bill not made yet" },
  { chalanNo: "9011", daysAgo: 41, party: "Mayra Creation", pieces: 75, status: "COMPLETED", isBilled: true, work: [["galu", 120], ["Sleevs", 80]], computerDesignNo: "4440" },
  { chalanNo: "9012", daysAgo: 47, party: "Amba Creation", pieces: 180, status: "IN_PROGRESS", work: [["Sleevs", 92]], partyDesignNo: "2238" },
];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const user = await getUserByUsername("testowner");
  if (!user) {
    console.error('No "testowner" account.');
    return;
  }
  const userId = user.id;

  const chalans = new Set(ROWS.map((r) => r.chalanNo));
  const existing = await listJobWorksPage(userId, { page: 1, pageSize: 500 });
  const mine = existing.rows.filter((r) => r.chalanNo && chalans.has(r.chalanNo));

  if (WIPE) {
    if (mine.length === 0) {
      console.log("Nothing to remove — no job works with chalan 9001–9012.");
      return;
    }
    for (const row of mine) {
      await deleteJobWork(userId, row.id);
      console.log(`  removed chalan ${row.chalanNo} (${row.partyName})`);
    }
    console.log(`\nRemoved ${mine.length} demo job work(s). Your own rows were untouched.`);
    return;
  }

  if (mine.length > 0) {
    console.log(`${mine.length} demo row(s) are already there — remove them first with:`);
    console.log("  npm run seed:demo -- --wipe");
    return;
  }

  const parties = await listParties(userId);
  const karigars = await listKarigars(userId);
  const links = await listKarigarPartyLinks(userId);
  const types = await listDescriptionTypes(userId);

  const typeByName = new Map(types.map((t) => [t.name.toLowerCase(), t]));

  let made = 0;
  for (const row of ROWS) {
    const party = parties.find((p) => p.name === row.party && !p.isArchived);
    if (!party) {
      console.log(`  skipped chalan ${row.chalanNo}: no party named "${row.party}"`);
      continue;
    }
    // Only a karigar actually linked to this party — the form would not offer
    // any other, and seeded data that the UI could not have produced is worse
    // than no data.
    const linkedIds = links.filter((l) => l.partyId === party.id).map((l) => l.karigarId);
    const karigar = karigars.find((k) => linkedIds.includes(k.id) && !k.isArchived);
    if (!karigar) {
      console.log(`  skipped chalan ${row.chalanNo}: no karigar linked to ${party.name}`);
      continue;
    }

    const lines = row.work
      .map(([name, price]) => {
        const t = typeByName.get(name.toLowerCase());
        return t ? { descriptionTypeId: t.id, price } : null;
      })
      .filter((l): l is { descriptionTypeId: string; price: number } => l !== null);

    if (lines.length === 0) {
      console.log(`  skipped chalan ${row.chalanNo}: none of its work types exist`);
      continue;
    }

    // The rate the form would have derived: the sum of the row prices.
    const rate = lines.reduce((a, l) => a + l.price, 0);
    const isBilled = row.status === "COMPLETED" && row.isBilled === true;

    await createJobWork(
      userId,
      {
        date: isoDaysAgo(row.daysAgo),
        partyId: party.id,
        karigarId: karigar.id,
        pieces: row.pieces,
        rate,
        total: computeTotal(row.pieces, rate),
        chalanNo: row.chalanNo,
        partyDesignNo: row.partyDesignNo ?? null,
        computerDesignNo: row.computerDesignNo ?? null,
        comment: row.comment ?? null,
        status: row.status,
        isBilled,
        photo1ImageId: null,
        photo2ImageId: null,
      },
      lines
    );
    made++;
    console.log(
      `  chalan ${row.chalanNo}  ${isoDaysAgo(row.daysAgo)}  ${party.name} / ${karigar.name}  ` +
        `${row.pieces} × ₹${rate} = ₹${computeTotal(row.pieces, rate).toLocaleString("en-IN")}  ` +
        `${row.status}${isBilled ? " (billed)" : ""}`
    );
  }

  console.log(`\nAdded ${made} job work(s). Remove them any time with:`);
  console.log("  npm run seed:demo -- --wipe");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

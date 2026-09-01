// Run with: npm run verify:money -- [username]
//
// Repeatable, self-cleaning verification that job-work money and price
// snapshots are correct against the LIVE database, going through the real
// repository functions (createJobWork/updateJobWork/getJobWorkWithDescriptions)
// the app's Server Actions call — not a parallel path.
//
// This is the single non-negotiable gate on Phase 3: the owner's own three
// book rows must come back out of Neon exactly as he wrote them, and renaming
// or archiving a description type must never alter a saved job work.
//
// Idempotent and self-cleaning: every row this script creates is deleted in a
// finally block, and every master-data mutation (rename/archive) is restored
// in a finally block too, so a failed run never leaves the owner's real data
// altered or leftover test job works in his ledger.
import "dotenv/config";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { jobWorkDescriptions, parties, silaiKarigars, descriptionTypes } from "../src/lib/db/schema";
import { getUserByUsername } from "../src/lib/db/repositories/users";
import { computeTotal } from "../src/lib/validation/job-work";
import {
  createJobWork,
  deleteJobWork,
  getJobWorkWithDescriptions,
} from "../src/lib/db/repositories/jobWorks";
import {
  updateDescriptionType,
  archiveDescriptionType,
  unarchiveDescriptionType,
} from "../src/lib/db/repositories/description-types";

let failures = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`PASS - ${label}`);
  } else {
    failures++;
    console.log(`FAIL - ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function main() {
  const username = process.argv[2] || "testowner";
  const user = await getUserByUsername(username);
  if (!user) {
    console.error(
      `No user found with username "${username}". Run "npm run user:create" or check the username. Aborting.`
    );
    process.exit(1);
  }
  const userId = user.id;

  // ---------- Check 1: computeTotal purity ----------
  check("Check 1a - computeTotal(126,162) === 20412", computeTotal(126, 162) === 20412);
  check("Check 1b - computeTotal(112,198) === 22176", computeTotal(112, 198) === 22176);
  check("Check 1c - computeTotal(459,155) === 71145", computeTotal(459, 155) === 71145);

  // ---------- Resolve required masters ----------
  const [mayra] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.userId, userId), eq(parties.name, "Mayra")));
  const [zuber] = await db
    .select()
    .from(silaiKarigars)
    .where(and(eq(silaiKarigars.userId, userId), eq(silaiKarigars.name, "Zuber")));
  const [galu] = await db
    .select()
    .from(descriptionTypes)
    .where(and(eq(descriptionTypes.userId, userId), eq(descriptionTypes.name, "Galu")));
  const [sleeve] = await db
    .select()
    .from(descriptionTypes)
    .where(and(eq(descriptionTypes.userId, userId), eq(descriptionTypes.name, "Sleeve")));

  if (!mayra || !zuber || !galu || !sleeve) {
    console.error(
      "Missing required seeded master data (Mayra party, Zuber karigar, Galu/Sleeve description types). " +
        "Run `npm run seed:masters` first. Aborting."
    );
    process.exit(1);
  }

  const createdJobWorkIds: string[] = [];
  let renamedGalu = false;
  let archivedSleeve = false;

  try {
    // ---------- Check 2: the three real book rows, persisted and read back ----------
    const bookRows: Array<{ pieces: number; rate: number; expectedTotal: number; priceA: number; priceB: number }> = [
      { pieces: 126, rate: 162, expectedTotal: 20412, priceA: 100, priceB: 62 },
      { pieces: 112, rate: 198, expectedTotal: 22176, priceA: 120, priceB: 78 },
      { pieces: 459, rate: 155, expectedTotal: 71145, priceA: 100, priceB: 55 },
    ];

    const readBackRows: Array<{ id: string; expected: (typeof bookRows)[number] }> = [];

    for (const row of bookRows) {
      const total = computeTotal(row.pieces, row.rate);
      const created = await createJobWork(
        userId,
        {
          date: "2026-01-01",
          partyId: mayra.id,
          karigarId: zuber.id,
          pieces: row.pieces,
          rate: row.rate,
          total,
          chalanNo: null,
          partyDesignNo: null,
          computerDesignNo: null,
          comment: "verify:money throwaway row",
          status: "PENDING",
          isBilled: false,
        },
        [
          { descriptionTypeId: galu.id, price: row.priceA },
          { descriptionTypeId: sleeve.id, price: row.priceB },
        ]
      );
      createdJobWorkIds.push(created.id);
      readBackRows.push({ id: created.id, expected: row });
    }

    for (const { id, expected } of readBackRows) {
      const readBack = await getJobWorkWithDescriptions(userId, id);
      check(
        `Check 2 - ${expected.pieces} x ${expected.rate} total reads back ${expected.expectedTotal}`,
        !!readBack && readBack.total === expected.expectedTotal,
        readBack ? `got ${readBack.total}` : "row missing"
      );
      check(
        `Check 2 - ${expected.pieces} x ${expected.rate} rate/pieces round-tripped as integers`,
        !!readBack &&
          Number.isInteger(readBack.rate) &&
          Number.isInteger(readBack.pieces) &&
          readBack.rate === expected.rate &&
          readBack.pieces === expected.pieces
      );
      check(
        `Check 2 - ${expected.pieces} x ${expected.rate} line prices came back exactly as typed`,
        !!readBack &&
          readBack.lines.length === 2 &&
          readBack.lines.some((l) => l.priceUsed === expected.priceA) &&
          readBack.lines.some((l) => l.priceUsed === expected.priceB)
      );
    }

    // ---------- Check 3: price snapshot immutability (JOB-06) ----------
    const firstId = createdJobWorkIds[0];
    const before = await getJobWorkWithDescriptions(userId, firstId);
    if (!before) {
      check("Check 3 - snapshot immutability", false, "could not re-read first created job work");
    } else {
      const beforeSnapshot = {
        total: before.total,
        rate: before.rate,
        prices: before.lines.map((l) => l.priceUsed).sort((a, b) => a - b),
      };

      await updateDescriptionType(userId, galu.id, { name: "Galu RENAMED" });
      renamedGalu = true;
      await archiveDescriptionType(userId, sleeve.id);
      archivedSleeve = true;

      const after = await getJobWorkWithDescriptions(userId, firstId);
      const afterSnapshot = after
        ? {
            total: after.total,
            rate: after.rate,
            prices: after.lines.map((l) => l.priceUsed).sort((a, b) => a - b),
          }
        : null;

      check(
        "Check 3 - total unchanged after rename + archive",
        !!afterSnapshot && afterSnapshot.total === beforeSnapshot.total
      );
      check(
        "Check 3 - rate unchanged after rename + archive",
        !!afterSnapshot && afterSnapshot.rate === beforeSnapshot.rate
      );
      check(
        "Check 3 - both priceUsed values byte-identical after rename + archive",
        !!afterSnapshot &&
          afterSnapshot.prices.length === beforeSnapshot.prices.length &&
          afterSnapshot.prices.every((p, i) => p === beforeSnapshot.prices[i])
      );
    }

    // ---------- Check 4: chalan no. is not unique (JOB-12) ----------
    const chalanA = await createJobWork(
      userId,
      {
        date: "2026-01-01",
        partyId: mayra.id,
        karigarId: zuber.id,
        pieces: 10,
        rate: 10,
        total: computeTotal(10, 10),
        chalanNo: "767",
        partyDesignNo: null,
        computerDesignNo: null,
        comment: "verify:money chalan dup A",
        status: "PENDING",
        isBilled: false,
      },
      [{ descriptionTypeId: galu.id, price: 10 }]
    );
    createdJobWorkIds.push(chalanA.id);

    const chalanB = await createJobWork(
      userId,
      {
        date: "2026-01-01",
        partyId: mayra.id,
        karigarId: zuber.id,
        pieces: 20,
        rate: 20,
        total: computeTotal(20, 20),
        chalanNo: "767",
        partyDesignNo: null,
        computerDesignNo: null,
        comment: "verify:money chalan dup B",
        status: "PENDING",
        isBilled: false,
      },
      [{ descriptionTypeId: galu.id, price: 20 }]
    );
    createdJobWorkIds.push(chalanB.id);

    const readA = await getJobWorkWithDescriptions(userId, chalanA.id);
    const readB = await getJobWorkWithDescriptions(userId, chalanB.id);
    check(
      "Check 4 - two job works can share chalan no. 767, both readable",
      !!readA && !!readB && readA.chalanNo === "767" && readB.chalanNo === "767"
    );

    // ---------- Check 5: no orphans after delete ----------
    for (const id of createdJobWorkIds) {
      await deleteJobWork(userId, id);
    }
    let allGone = true;
    for (const id of createdJobWorkIds) {
      const gone = await getJobWorkWithDescriptions(userId, id);
      if (gone !== null) allGone = false;
    }
    check("Check 5 - every created job work is unreadable after delete", allGone);

    const [{ count: orphanCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobWorkDescriptions)
      .where(inArray(jobWorkDescriptions.jobWorkId, createdJobWorkIds));
    check("Check 5 - no orphaned job_work_descriptions rows remain", orphanCount === 0, `count=${orphanCount}`);

    createdJobWorkIds.length = 0; // all cleaned up above; finally block below is now a no-op for job works
  } finally {
    // Cleanup: delete any job works that somehow weren't cleaned up above
    // (e.g. an assertion threw before Check 5's delete loop ran).
    for (const id of createdJobWorkIds) {
      try {
        await deleteJobWork(userId, id);
      } catch {
        // best-effort cleanup
      }
    }

    // Restore master data exactly as found, regardless of what failed above.
    if (renamedGalu) {
      await updateDescriptionType(userId, galu.id, { name: "Galu" });
    }
    if (archivedSleeve) {
      await unarchiveDescriptionType(userId, sleeve.id);
    }
  }

  console.log("");
  console.log(`verify:money finished with ${failures} failure(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("verify:money crashed:", err);
  process.exit(1);
});

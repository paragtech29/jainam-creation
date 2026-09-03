// Wipe all business data, keeping user accounts.
//
//   npm run reset:data            -- prints what WOULD be deleted, changes nothing
//   npm run reset:data -- --yes   -- actually deletes
//
// Deliberately never touches the users table: without an account you cannot
// log in to test the empty state you just created.
//
// Order matters. Children first, so a foreign key never blocks a parent —
// job_work_descriptions before job_works, party_karigars before either side
// of the link.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  users,
  parties,
  silaiKarigars,
  partyKarigars,
  descriptionTypes,
  jobWorks,
  jobWorkDescriptions,
} from "../src/lib/db/schema";

const TABLES = [
  { name: "job_work_descriptions", table: jobWorkDescriptions },
  { name: "job_works", table: jobWorks },
  { name: "party_karigars", table: partyKarigars },
  { name: "description_types", table: descriptionTypes },
  { name: "silai_karigars", table: silaiKarigars },
  { name: "parties", table: parties },
] as const;

async function counts() {
  const out: Record<string, number> = {};
  for (const { name, table } of TABLES) {
    const rows = (await db.select({ n: sql<number>`count(*)::int` }).from(table as never)) as { n: number }[];
    out[name] = rows[0].n;
  }
  return out;
}

async function main() {
  const confirmed = process.argv.includes("--yes");
  const before = await counts();
  const total = Object.values(before).reduce((a, b) => a + b, 0);

  console.log("Current business data:");
  for (const [k, v] of Object.entries(before)) console.log("  " + k.padEnd(24) + v);
  console.log("  " + "TOTAL".padEnd(24) + total);

  const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  console.log(`\nUser accounts: ${u.n} — NOT touched by this script.`);

  if (!confirmed) {
    console.log("\nDry run. Nothing deleted. Re-run with --yes to delete the rows above.");
    return;
  }
  if (total === 0) {
    console.log("\nAlready empty. Nothing to do.");
    return;
  }

  // One transaction: a half-finished wipe would leave orphaned links behind.
  await db.transaction(async (tx) => {
    for (const { table } of TABLES) await tx.delete(table as never);
  });

  const after = await counts();
  const left = Object.values(after).reduce((a, b) => a + b, 0);
  console.log("\nAfter:");
  for (const [k, v] of Object.entries(after)) console.log("  " + k.padEnd(24) + v);
  console.log(left === 0 ? "\nAll business data cleared. Accounts intact." : `\nWARNING: ${left} row(s) remain.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

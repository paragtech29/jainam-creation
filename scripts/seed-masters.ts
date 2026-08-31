// Run with: npm run seed:masters -- [username]
// Idempotent seed of the owner's REAL master data (parties, karigars,
// particulars, and the party<->karigar links) for verification. Defaults to
// the "testowner" account. Never deletes or modifies anything, and never
// touches the users table beyond a read lookup.
//
// `parties` and `silai_karigars` have no unique index on name, so
// `.onConflictDoNothing()` alone would NOT dedupe them across repeated runs
// — we explicitly select existing rows by name first and skip. `particulars`
// DOES have a (userId, name) unique index, so onConflictDoNothing suffices
// there.
import "dotenv/config";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { parties, silaiKarigars, particulars, partyKarigars } from "../src/lib/db/schema";
import { getUserByUsername } from "../src/lib/db/repositories/users";

const PARTIES = [
  { name: "Mayra", ownerName1: "Mayra bhai", address: "Surat, Gujarat", email: "mayra@example.com", contact1: "9876500001", contact2: "9876500002" },
  { name: "Amba", ownerName1: "Amba bhai" },
  { name: "Jignesh bhai", ownerName1: "Jignesh" },
];

const KARIGARS = [
  { name: "Zuber", contact1: "9876511111" },
  { name: "Alfaz" },
  { name: "Abdul bhai" },
  { name: "Kamlesh" },
];

const PARTICULARS = [
  { name: "ગળુ", defaultPrice: 162 },
  { name: "સ્લવ", defaultPrice: 198 },
  { name: "દુપટ્ટો", defaultPrice: 155 },
  { name: "દામન", defaultPrice: 120 },
  { name: "પટ્ટી", defaultPrice: 85 },
];

// party name -> karigar names
const LINKS: Record<string, string[]> = {
  Mayra: ["Zuber", "Alfaz"],
  Amba: ["Zuber"],
  "Jignesh bhai": ["Kamlesh"],
  // "Abdul bhai" intentionally has no links — covers the empty case.
};

async function main() {
  const username = process.argv[2] || "testowner";
  const user = await getUserByUsername(username);
  if (!user) {
    console.error(`No user found with username "${username}". Aborting.`);
    process.exit(1);
  }
  const userId = user.id;

  // ---------- parties ----------
  const existingParties = await db
    .select()
    .from(parties)
    .where(eq(parties.userId, userId));
  const existingPartyNames = new Set(existingParties.map((p) => p.name));

  let partiesCreated = 0;
  let partiesSkipped = 0;
  for (const p of PARTIES) {
    if (existingPartyNames.has(p.name)) {
      partiesSkipped++;
      continue;
    }
    await db.insert(parties).values({ userId, ...p });
    partiesCreated++;
  }

  // ---------- karigars ----------
  const existingKarigars = await db
    .select()
    .from(silaiKarigars)
    .where(eq(silaiKarigars.userId, userId));
  const existingKarigarNames = new Set(existingKarigars.map((k) => k.name));

  let karigarsCreated = 0;
  let karigarsSkipped = 0;
  for (const k of KARIGARS) {
    if (existingKarigarNames.has(k.name)) {
      karigarsSkipped++;
      continue;
    }
    await db.insert(silaiKarigars).values({ userId, ...k });
    karigarsCreated++;
  }

  // ---------- particulars (unique index handles dedupe) ----------
  let particularsCreated = 0;
  for (const particular of PARTICULARS) {
    const [row] = await db
      .insert(particulars)
      .values({ userId, ...particular })
      .onConflictDoNothing({ target: [particulars.userId, particulars.name] })
      .returning({ id: particulars.id });
    if (row) particularsCreated++;
  }
  const particularsSkipped = PARTICULARS.length - particularsCreated;

  // ---------- party <-> karigar links ----------
  const allParties = await db
    .select()
    .from(parties)
    .where(and(eq(parties.userId, userId), inArray(parties.name, Object.keys(LINKS))));
  const allKarigars = await db
    .select()
    .from(silaiKarigars)
    .where(eq(silaiKarigars.userId, userId));

  const partyIdByName = new Map(allParties.map((p) => [p.name, p.id]));
  const karigarIdByName = new Map(allKarigars.map((k) => [k.name, k.id]));

  let linksCreated = 0;
  let linksSkipped = 0;
  for (const [partyName, karigarNames] of Object.entries(LINKS)) {
    const partyId = partyIdByName.get(partyName);
    if (!partyId) continue;
    for (const karigarName of karigarNames) {
      const karigarId = karigarIdByName.get(karigarName);
      if (!karigarId) continue;
      const [row] = await db
        .insert(partyKarigars)
        .values({ partyId, karigarId })
        .onConflictDoNothing()
        .returning();
      if (row) linksCreated++;
      else linksSkipped++;
    }
  }

  console.log(`Seed summary for user "${username}" (id: ${userId}):`);
  console.log(`  Parties:     ${partiesCreated} created, ${partiesSkipped} skipped`);
  console.log(`  Karigars:    ${karigarsCreated} created, ${karigarsSkipped} skipped`);
  console.log(`  Particulars: ${particularsCreated} created, ${particularsSkipped} skipped`);
  console.log(`  Links:       ${linksCreated} created, ${linksSkipped} skipped`);

  process.exit(0);
}

main();

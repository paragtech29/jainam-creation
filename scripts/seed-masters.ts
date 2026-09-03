// Run with: npm run seed:masters -- [username]
// Idempotent seed of the owner's REAL master data (parties, karigars,
// descriptionTypes, and the party<->karigar links) for verification. Defaults to
// the "testowner" account. Never deletes or modifies anything, and never
// touches the users table beyond a read lookup.
//
// `parties` and `silai_karigars` have no unique index on name, so
// `.onConflictDoNothing()` alone would NOT dedupe them across repeated runs
// — we explicitly select existing rows by name first and skip. `descriptionTypes`
// DOES have a (userId, name) unique index, so onConflictDoNothing suffices
// there.
import "dotenv/config";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { parties, silaiKarigars, descriptionTypes, partyKarigars } from "../src/lib/db/schema";
import { getUserByUsername } from "../src/lib/db/repositories/users";

const PARTIES = [
  { name: "Mayra", ownerName1: "Mayra bhai", address: "Surat, Gujarat", email: "mayra@example.com", gender: "male", contact1: "9876500001", contact2: "9876500002" },
  { name: "Amba", ownerName1: "Amba bhai", gender: "male", contact1: "9876500011" },
  { name: "Jignesh bhai", ownerName1: "Jignesh", gender: "male", contact1: "9876500021" },
];

const KARIGARS = [
  { name: "Zuber", contact1: "9876511111" },
  { name: "Alfaz", contact1: "9876511122" },
  { name: "Abdul bhai", contact1: "9876511133" },
  { name: "Kamlesh", contact1: "9876511144" },
];

// The kinds of work that appear on a job work's description lines. English,
// as the owner asked — his book is handwritten in Gujarati but the app is not.
// No prices here: the price is typed per job work.
const DESCRIPTION_TYPES = [
  { name: "Galu" },
  { name: "Sleeve" },
  { name: "Dupatta" },
  { name: "Daman" },
  { name: "Patti" },
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

  // ---------- description types (unique index handles dedupe) ----------
  let typesCreated = 0;
  for (const t of DESCRIPTION_TYPES) {
    const [row] = await db
      .insert(descriptionTypes)
      .values({ userId, ...t })
      .onConflictDoNothing({ target: [descriptionTypes.userId, descriptionTypes.name] })
      .returning({ id: descriptionTypes.id });
    if (row) typesCreated++;
  }
  const typesSkipped = DESCRIPTION_TYPES.length - typesCreated;

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
  console.log(`  Description types: ${typesCreated} created, ${typesSkipped} skipped`);
  console.log(`  Links:       ${linksCreated} created, ${linksSkipped} skipped`);

  process.exit(0);
}

main();

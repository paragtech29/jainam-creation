// A full demo dataset: parties, silai karigars, work types, and two years of
// job works — enough to test pagination, archiving, deleting, filtering and
// the reports the way they will actually behave.
//
//   npm run seed:demo           -> add it (refuses if it is already there)
//   npm run seed:demo -- --wipe -> remove exactly what it added
//
// EVERYTHING IT CREATES IS REMOVABLE, and it never touches rows the owner
// made himself. Two markers do that work:
//   * parties, karigars and work types are matched by exact NAME from the
//     lists below
//   * job works are matched by a chalan number in the block 9001–9099
// His own party "Mayra Creation", his karigars, his work types and his own
// job works are outside both, so --wipe cannot reach them.
//
// The data is deliberately shaped to exercise the app rather than to look
// full:
//   * two calendar years, so the report year picker and the dashboard's
//     month arrows both have somewhere to go
//   * every status, and only COMPLETED rows are ever billed — the rule the
//     app enforces, so no seeded row is one the UI could not have produced
//   * a karigar shared between two parties, which is the real business case
//   * one archived party and one archived karigar, so the archive filters
//     have something to show
//   * more than ten parties and more than ten karigars, because the lists
//     page at ten and a pager that never appears cannot be tried
//   * a party and a karigar with NO job works, so their Delete button appears
//     (the app hides Delete once a record has job works) — otherwise the
//     delete path cannot be tried at all
import "dotenv/config";
import { getUserByUsername } from "../src/lib/db/repositories/users";
import {
  listPartiesPage,
  createParty,
  archiveParty,
  deleteParty,
  addKarigarToParty,
} from "../src/lib/db/repositories/parties";
import {
  listKarigarsPage,
  createKarigar,
  archiveKarigar,
  deleteKarigar,
} from "../src/lib/db/repositories/karigars";
import {
  listDescriptionTypes,
  createDescriptionType,
  deleteDescriptionType,
} from "../src/lib/db/repositories/description-types";
import {
  createJobWork,
  listJobWorksPage,
  deleteJobWork,
} from "../src/lib/db/repositories/jobWorks";
import { computeTotal } from "../src/lib/validation/job-work";

const WIPE = process.argv.includes("--wipe");

// ── what gets created ────────────────────────────────────────────────────
const PARTIES = [
  { name: "Shreeji Creation", ownerName1: "Nilesh bhai", ownerName2: "Kalpesh bhai", contact1: "98250 41120", gender: "male", address: "Ring Road, Surat" },
  { name: "Riddhi Fashion", ownerName1: "Hetal ben", contact1: "97250 33418", gender: "female", address: "Salabatpura, Surat" },
  { name: "Krishna Textiles", ownerName1: "Bharat bhai", contact1: "99040 77215", gender: "male", address: "Katargam, Surat" },
  { name: "Sai Silk Mills", ownerName1: "Pravin bhai", ownerName2: "Jagdish bhai", contact1: "94270 55901", gender: "male", address: "Udhna, Surat" },
  { name: "Navkar Sarees", ownerName1: "Rekha ben", contact1: "90990 21764", gender: "female", address: "Varachha, Surat" },
  { name: "Laxmi Silk House", ownerName1: "Ashok bhai", contact1: "98795 10233", gender: "male", address: "Sahara Darwaja, Surat" },
  { name: "Radhe Creation", ownerName1: "Jayesh bhai", ownerName2: "Ramesh bhai", contact1: "97129 45580", gender: "male", address: "Kapodra, Surat" },
  { name: "Mahavir Fashion", ownerName1: "Sunita ben", contact1: "94288 30176", gender: "female", address: "Bhagal, Surat" },
  { name: "Ganesh Textiles", ownerName1: "Vipul bhai", contact1: "99251 62037", gender: "male", address: "Pandesara, Surat" },
  { name: "Umiya Creation", ownerName1: "Kiran bhai", contact1: "90333 71824", gender: "male", address: "Amroli, Surat" },
  { name: "Balaji Sarees", ownerName1: "Mansi ben", contact1: "93135 20649", gender: "female", address: "Parvat Patiya, Surat" },
  { name: "Satguru Fabrics", ownerName1: "Harish bhai", contact1: "97267 84413", gender: "male", address: "Dindoli, Surat" },
  // Archived on purpose, so "Show archived" has something to show.
  { name: "Anand Fabrics", ownerName1: "Dinesh bhai", contact1: "93770 60432", gender: "male", address: "Bhatar, Surat", archived: true },
  // Deliberately given NO job works, so its Delete button is offered.
  { name: "Vraj Creation", ownerName1: "Manish bhai", contact1: "91730 12908", gender: "male", address: "Adajan, Surat", noWork: true },
];

const KARIGARS = [
  { name: "Imran bhai", contact1: "98795 30021", address: "Limbayat" },
  { name: "Sohail", contact1: "97140 88213", address: "Navsari Bazaar" },
  { name: "Nadeem bhai", contact1: "99790 44510", address: "Rander" },
  { name: "Rafiq bhai", contact1: "90163 27788", address: "Godadara" },
  { name: "Javed bhai", contact1: "98241 60915", address: "Sonifaliya" },
  { name: "Arif", contact1: "97370 22684", address: "Umarwada" },
  { name: "Shakeel bhai", contact1: "99136 40072", address: "Magdalla" },
  { name: "Yunus", contact1: "94081 55319", address: "Bhestan" },
  { name: "Iqbal bhai", contact1: "90992 17408", address: "Sachin" },
  { name: "Mustak", contact1: "93281 60947", address: "Ved Road" },
  { name: "Anwar bhai", contact1: "97255 38810", address: "Katargam" },
  { name: "Zahid", contact1: "98984 71260", address: "Anjana Farm" },
  // Archived on purpose.
  { name: "Salim", contact1: "94086 51230", address: "Pandesara", archived: true },
  // No job works, so it can be deleted.
  { name: "Firoz bhai", contact1: "93280 71145", address: "Dumbhal", noWork: true },
];

// Galu and Sleeve already exist in his data (as "galu" and "Sleevs"), so only
// the missing ones are added — a duplicate name is refused by the app anyway.
const TYPES = ["Dupatta", "Daman", "Patti", "Mirror work"];

const CHALAN_FROM = 9001;
const CHALAN_TO = 9099;

// ── a deterministic shuffle, so two runs produce the same book ───────────
// Not Math.random: a demo dataset that changes every run makes "is this
// figure right?" impossible to answer twice.
let seed = 20260909;
function rnd() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function main() {
  const user = await getUserByUsername("testowner");
  if (!user) {
    console.error('No "testowner" account.');
    return;
  }
  const userId = user.id;

  const partyNames = new Set(PARTIES.map((p) => p.name));
  const karigarNames = new Set(KARIGARS.map((k) => k.name));
  const typeNames = new Set(TYPES.map((t) => t.toLowerCase()));

  // ── wipe ───────────────────────────────────────────────────────────────
  if (WIPE) {
    const jobs = await listJobWorksPage(userId, { page: 1, pageSize: 1000 });
    const mine = jobs.rows.filter((r) => {
      const n = Number(r.chalanNo);
      return Number.isInteger(n) && n >= CHALAN_FROM && n <= CHALAN_TO;
    });
    for (const j of mine) await deleteJobWork(userId, j.id);
    console.log(`removed ${mine.length} job work(s)`);

    // Karigars before parties: the link rows hang off both, and a party with
    // a linked karigar is the harder case.
    let n = 0;
    const allKarigars = (await listKarigarsPage(userId, { includeArchived: true, pageSize: 500 })).rows;
    for (const k of allKarigars) {
      if (!karigarNames.has(k.name)) continue;
      try {
        await deleteKarigar(userId, k.id);
        n++;
      } catch (e) {
        console.log(`  kept karigar "${k.name}": ${(e as Error).message}`);
      }
    }
    console.log(`removed ${n} karigar(s)`);

    n = 0;
    const allParties = (await listPartiesPage(userId, { includeArchived: true, pageSize: 500 })).rows;
    for (const p of allParties) {
      if (!partyNames.has(p.name)) continue;
      try {
        await deleteParty(userId, p.id);
        n++;
      } catch (e) {
        console.log(`  kept party "${p.name}": ${(e as Error).message}`);
      }
    }
    console.log(`removed ${n} part(y/ies)`);

    n = 0;
    for (const t of await listDescriptionTypes(userId)) {
      if (!typeNames.has(t.name.toLowerCase())) continue;
      const res = await deleteDescriptionType(userId, t.id);
      if (res.ok) n++;
      else console.log(`  kept work type "${t.name}": ${res.reason}`);
    }
    console.log(`removed ${n} work type(s)`);
    console.log("\nYour own records were not touched.");
    return;
  }

  // ── guard ──────────────────────────────────────────────────────────────
  const existingParties = (await listPartiesPage(userId, { includeArchived: true, pageSize: 500 })).rows;
  if (existingParties.some((p) => partyNames.has(p.name))) {
    console.log("The demo data is already there. Remove it first with:");
    console.log("  npm run seed:demo -- --wipe");
    return;
  }

  // ── parties, karigars, links, types ───────────────────────────────────
  const madeParties: { id: string; name: string; noWork: boolean }[] = [];
  for (const p of PARTIES) {
    const row = await createParty(userId, {
      name: p.name,
      ownerName1: p.ownerName1,
      ownerName2: p.ownerName2 ?? null,
      address: p.address ?? null,
      gender: p.gender ?? null,
      email: null,
      contact1: p.contact1 ?? null,
      contact2: null,
      isArchived: false,
    });
    if (p.archived) await archiveParty(userId, row.id);
    madeParties.push({ id: row.id, name: row.name, noWork: p.noWork === true });
  }
  console.log(`added ${madeParties.length} parties`);

  const madeKarigars: { id: string; name: string; noWork: boolean }[] = [];
  for (const k of KARIGARS) {
    const row = await createKarigar(userId, {
      name: k.name,
      address: k.address ?? null,
      contact1: k.contact1 ?? null,
      contact2: null,
      isArchived: false,
    });
    if (k.archived) await archiveKarigar(userId, row.id);
    madeKarigars.push({ id: row.id, name: row.name, noWork: k.noWork === true });
  }
  console.log(`added ${madeKarigars.length} silai karigars`);

  // Each working karigar sews for two parties, and the first sews for three —
  // a karigar shared between parties is the real business case the whole
  // linking model exists for.
  const workParties = madeParties.filter((p) => !p.noWork);
  const workKarigars = madeKarigars.filter((k) => !k.noWork);
  const links: { partyId: string; karigarId: string }[] = [];
  workKarigars.forEach((k, i) => {
    const count = i === 0 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const party = workParties[(i + j) % workParties.length];
      links.push({ partyId: party.id, karigarId: k.id });
    }
  });
  for (const l of links) await addKarigarToParty(userId, l.partyId, l.karigarId);
  console.log(`linked ${links.length} karigar-party pairs`);

  // Anything a test run left behind is excluded: a demo job work whose work
  // line reads "ZZ Test QA xxxx Work" is not demo data, and it would also pin
  // that type in place - tidy:test refuses to delete a type that is in use.
  const existingTypes = (await listDescriptionTypes(userId)).filter(
    (t) => !/^ZZ Test/i.test(t.name)
  );
  const typeRows = [...existingTypes];
  for (const name of TYPES) {
    if (existingTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) continue;
    typeRows.push(await createDescriptionType(userId, { name, isArchived: false }));
  }
  console.log(`work types available: ${typeRows.map((t) => t.name).join(", ")}`);

  // ── job works, across last year and this one ──────────────────────────
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "COMPLETED", "COMPLETED"] as const;

  let chalan = CHALAN_FROM;
  let made = 0;
  const perMonth: Record<string, number> = {};

  // Last year in full; this year up to the current month. Older work is
  // mostly settled and newer work mostly is not, which is what a real book
  // looks like — and it gives the reports something different to say about
  // each year.
  const months: { y: number; m: number; settled: boolean }[] = [];
  for (let m = 1; m <= 12; m++) months.push({ y: lastYear, m, settled: true });
  for (let m = 1; m <= now.getMonth() + 1; m++) months.push({ y: thisYear, m, settled: false });

  for (const { y, m, settled } of months) {
    const count = between(2, 4);
    for (let i = 0; i < count && chalan <= CHALAN_TO; i++) {
      const link = links[Math.floor(rnd() * links.length)];
      const party = madeParties.find((p) => p.id === link.partyId)!;
      const karigar = madeKarigars.find((k) => k.id === link.karigarId)!;

      const lineCount = rnd() > 0.6 ? 2 : 1;
      const lines: { descriptionTypeId: string; price: number }[] = [];
      for (let l = 0; l < lineCount; l++) {
        const t = pick(typeRows);
        if (lines.some((x) => x.descriptionTypeId === t.id)) continue;
        lines.push({ descriptionTypeId: t.id, price: between(70, 240) });
      }
      const rate = lines.reduce((a, l) => a + l.price, 0);
      const pieces = between(40, 520);

      const status = settled ? "COMPLETED" : pick([...STATUSES]);
      // The app's rule: only a COMPLETED job work can be billed. Older work is
      // nearly always billed; recent completed work often is not, which is
      // exactly what the "To invoice" figure is for.
      const isBilled = status === "COMPLETED" && (settled ? rnd() > 0.15 : rnd() > 0.6);

      await createJobWork(
        userId,
        {
          date: iso(y, m, between(1, 27)),
          partyId: party.id,
          karigarId: karigar.id,
          pieces,
          rate,
          total: computeTotal(pieces, rate),
          chalanNo: String(chalan),
          partyDesignNo: rnd() > 0.3 ? String(between(1000, 9999)) : null,
          computerDesignNo: rnd() > 0.5 ? String(between(1000, 9999)) : null,
          comment: rnd() > 0.85 ? "Two colours" : null,
          status,
          isBilled,
          photo1ImageId: null,
          photo2ImageId: null,
        },
        lines
      );
      const key = `${y}-${String(m).padStart(2, "0")}`;
      perMonth[key] = (perMonth[key] ?? 0) + 1;
      chalan++;
      made++;
    }
  }

  console.log(`\nadded ${made} job works (chalan ${CHALAN_FROM}–${chalan - 1})`);
  const years = [...new Set(Object.keys(perMonth).map((k) => k.slice(0, 4)))];
  for (const y of years) {
    const n = Object.entries(perMonth)
      .filter(([k]) => k.startsWith(y))
      .reduce((a, [, v]) => a + v, 0);
    console.log(`  ${y}: ${n} job works across ${Object.keys(perMonth).filter((k) => k.startsWith(y)).length} months`);
  }
  console.log("\nAlso added for testing:");
  console.log("  · 1 archived party (Anand Fabrics) and 1 archived karigar (Salim)");
  console.log("  · 1 party (Vraj Creation) and 1 karigar (Firoz bhai) with no job works, so Delete is offered");
  console.log("\nRemove all of it with:  npm run seed:demo -- --wipe");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

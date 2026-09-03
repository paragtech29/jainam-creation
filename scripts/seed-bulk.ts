// Bulk test data, so pagination, scrolling and long lists can be exercised
// for real instead of reasoned about.
//
//   npm run seed:bulk            -> 24 parties, 24 karigars, 24 job works
//   npm run seed:bulk -- --wipe  -> remove ONLY the rows this script made
//
// Every row it creates is named with a "ZZ Test" prefix so --wipe can find
// its own work and never touches the owner's real records.
import "dotenv/config";
import { getUserByUsername } from "../src/lib/db/repositories/users";
import {
  createParty,
  listParties,
  deleteParty,
} from "../src/lib/db/repositories/parties";
import {
  createKarigar,
  listKarigars,
  deleteKarigar,
  replaceKarigarPartyLinks,
} from "../src/lib/db/repositories/karigars";
import { listDescriptionTypes } from "../src/lib/db/repositories/description-types";
import { computeTotal } from "../src/lib/validation/job-work";
import {
  createJobWork,
  listJobWorksPage,
  deleteJobWork,
} from "../src/lib/db/repositories/jobWorks";

async function main() {
  const PREFIX = "ZZ Test";
  const COUNT = 24;
  const WIPE = process.argv.includes("--wipe");

  const user = await getUserByUsername("testowner");
  if (!user) {
    console.error('No "testowner" account. Run `npm run user:create` first.');
    process.exit(1);
  }
  const userId = user.id;

  if (WIPE) {
    let removed = 0;
    const jobs = await listJobWorksPage(userId, { search: PREFIX, page: 1, pageSize: 500 });
    for (const j of jobs.rows) {
      await deleteJobWork(userId, j.id);
      removed++;
    }
    for (const k of await listKarigars(userId)) {
      if (k.name.startsWith(PREFIX)) {
        await deleteKarigar(userId, k.id);
        removed++;
      }
    }
    for (const p of await listParties(userId)) {
      if (p.name.startsWith(PREFIX)) {
        await deleteParty(userId, p.id);
        removed++;
      }
    }
    console.log(`Removed ${removed} "${PREFIX}" row(s). Real records untouched.`);
    return;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const partyIds: string[] = [];
  const karigarIds: string[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const p = await createParty(userId, {
      name: `${PREFIX} Party ${pad(i)}`,
      ownerName1: `Owner ${pad(i)}`,
      ownerName2: "",
      address: `Shop ${i}, Ring Road, Surat`,
      gender: i % 2 ? "male" : "female",
      email: "",
      contact1: `98765${pad(i)}001`,
      contact2: "",
    });
    partyIds.push(p.id);

    const k = await createKarigar(userId, {
      name: `${PREFIX} Karigar ${pad(i)}`,
      address: `Lane ${i}, Surat`,
      contact1: `98765${pad(i)}002`,
      contact2: "",
    });
    karigarIds.push(k.id);
    await replaceKarigarPartyLinks(userId, k.id, [p.id]);
  }

  const types = await listDescriptionTypes(userId);
  if (types.length === 0) {
    console.error("No description types. Run `npm run seed:masters` first.");
    process.exit(1);
  }

  const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
  for (let i = 1; i <= COUNT; i++) {
    const pieces = 40 + i * 3;
    const price = 50 + (i % 7) * 15;
    const rate = price * 2;
    const status = STATUSES[i % 3];
    const d = new Date(Date.UTC(2026, 7, 1 + (i % 28)));
    await createJobWork(
      userId,
      {
        date: d.toISOString().slice(0, 10),
        partyId: partyIds[i % partyIds.length],
        karigarId: karigarIds[i % karigarIds.length],
        chalanNo: String(700 + i),
        partyDesignNo: String(7000 + i),
        computerDesignNo: String(4000 + i),
        pieces,
        rate,
        total: computeTotal(pieces, rate),
        status,
        isBilled: status === "COMPLETED" && i % 2 === 0,
        comment: i % 4 === 0 ? `${PREFIX} note for chalan ${700 + i}` : "",
      },
      [
        { descriptionTypeId: types[i % types.length].id, price },
        { descriptionTypeId: types[(i + 1) % types.length].id, price },
      ]
    );
  }

  console.log(
    `Seeded ${COUNT} parties, ${COUNT} karigars and ${COUNT} job works, all prefixed "${PREFIX}".\n` +
      `Remove them with: npm run seed:bulk -- --wipe`
  );

}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

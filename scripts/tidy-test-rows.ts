// One-off tidy-up: removes rows left behind by ad-hoc UI testing before the
// "ZZ Test" naming convention existed. Matches only obvious test names and
// prints every row before deleting, so nothing real disappears quietly.
//
//   npm run tidy:test           -> list what it would remove
//   npm run tidy:test -- --yes  -> remove them
import "dotenv/config";
import { getUserByUsername } from "../src/lib/db/repositories/users";
import { listParties, deleteParty } from "../src/lib/db/repositories/parties";
import { listKarigars, deleteKarigar } from "../src/lib/db/repositories/karigars";

const PATTERNS = [/^ZZ Test/i, /^QA /i, /^Clean Party/i, /^Recover /i, /^Retain /i];
const APPLY = process.argv.includes("--yes");

async function main() {
  const user = await getUserByUsername("testowner");
  if (!user) {
    console.error('No "testowner" account.');
    return;
  }
  const userId = user.id;
  const isTest = (n: string) => PATTERNS.some((p) => p.test(n));

  const parties = (await listParties(userId)).filter((p) => isTest(p.name));
  const karigars = (await listKarigars(userId)).filter((k) => isTest(k.name));

  console.log(`Test-looking parties (${parties.length}):`);
  for (const p of parties) console.log("  " + p.name);
  console.log(`Test-looking karigars (${karigars.length}):`);
  for (const k of karigars) console.log("  " + k.name);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --yes to delete these.");
    return;
  }

  let removed = 0;
  // Karigars first: a party with a linked karigar is the harder case, and
  // deleting the link side first keeps the delete guards happy.
  for (const k of karigars) {
    try { await deleteKarigar(userId, k.id); removed++; }
    catch (e) { console.log(`  kept karigar "${k.name}": ${(e as Error).message}`); }
  }
  for (const p of parties) {
    try { await deleteParty(userId, p.id); removed++; }
    catch (e) { console.log(`  kept party "${p.name}": ${(e as Error).message}`); }
  }
  console.log(`\nRemoved ${removed} row(s).`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

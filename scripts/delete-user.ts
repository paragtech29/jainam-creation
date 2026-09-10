// Remove a user account, and with it everything that account owns.
//
//   npm run user:delete -- <username>          -- show what would go
//   npm run user:delete -- <username> --yes    -- actually remove it
//
// EVERY table hangs off users with ON DELETE CASCADE, so removing an account
// removes its parties, karigars, work types, job works, description lines and
// stored images in one step. That is the point — a half-deleted account would
// leave rows nobody can reach and nobody can clean up — but it also means
// there is no undo. Hence the dry run, and hence printing the counts first:
// the number of job works about to disappear is the one fact worth reading
// twice.
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  users,
  parties,
  silaiKarigars,
  descriptionTypes,
  jobWorks,
  images,
} from "../src/lib/db/schema";
import { getUserByUsername } from "../src/lib/db/repositories/users";

const args = process.argv.slice(2).filter((a) => a !== "--yes");
const APPLY = process.argv.includes("--yes");
const username = args[0];

async function main() {
  if (!username) {
    console.error("Usage: npm run user:delete -- <username> [--yes]");
    process.exitCode = 1;
    return;
  }

  const user = await getUserByUsername(username);
  if (!user) {
    console.error(`No account named "${username}".`);
    process.exitCode = 1;
    return;
  }

  const count = async (table: typeof parties | typeof silaiKarigars | typeof descriptionTypes | typeof jobWorks | typeof images) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(eq(table.userId, user.id));
    return row?.n ?? 0;
  };

  const owned = {
    parties: await count(parties),
    karigars: await count(silaiKarigars),
    workTypes: await count(descriptionTypes),
    jobWorks: await count(jobWorks),
    images: await count(images),
  };

  console.log(`Account "${username}" (${user.id}) owns:`);
  for (const [k, v] of Object.entries(owned)) console.log(`  ${k}: ${v}`);

  if (!APPLY) {
    console.log("\nDry run. All of the above would be deleted with the account.");
    console.log(`Re-run with:  npm run user:delete -- ${username} --yes`);
    return;
  }

  await db.delete(users).where(and(eq(users.id, user.id)));

  const gone = await getUserByUsername(username);
  console.log(gone ? `\nFAILED: "${username}" is still there.` : `\nDeleted "${username}" and everything it owned.`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

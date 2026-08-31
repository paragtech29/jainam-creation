// Run with: npm run user:create -- <username> <password>
// Loads .env.local explicitly since tsx does not read Next.js env files
// automatically (npm run scripts also pass --env-file=.env.local as a
// belt-and-braces measure — see package.json).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createUser, getUserByUsername } from "../src/lib/db/repositories/users";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: npm run user:create -- <username> <password>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await createUser(username, passwordHash);

  if (created) {
    console.log(`Created new user "${username}" (id: ${created.id}).`);
  } else {
    const existing = await getUserByUsername(username);
    console.log(
      `User "${username}" already existed (id: ${existing?.id ?? "unknown"}) — no changes made.`,
    );
  }

  process.exit(0);
}

main();

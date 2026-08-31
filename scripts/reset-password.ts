// Run with: npm run user:reset-password -- <username> <newPassword>
// This is the AUTH-07 lockout recovery path: there is no email or OTP in
// this system, so a documented script run directly against the database
// IS the only way to recover a forgotten password. See README.md.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { getUserByUsername, updatePasswordHash } from "../src/lib/db/repositories/users";

async function main() {
  const [username, newPassword] = process.argv.slice(2);
  if (!username || !newPassword) {
    console.error("Usage: npm run user:reset-password -- <username> <newPassword>");
    process.exit(1);
  }

  const user = await getUserByUsername(username);
  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updatedId = await updatePasswordHash(user.id, passwordHash);

  if (!updatedId) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }

  console.log(`Password reset for user "${username}" (id: ${updatedId}).`);
  process.exit(0);
}

main();

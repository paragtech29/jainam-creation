// Proves the neon-serverless (WebSocket/Pool) driver actually connects to
// the real Neon database before any schema or auth code is built on top of
// it. Run with: npm run db:smoke
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";

async function main() {
  try {
    const result = await db.execute(
      sql`select 1 as ok, current_database() as dbname, version() as pgversion`
    );
    console.log("DB smoke test result:", result.rows ?? result);
    process.exit(0);
  } catch (err) {
    console.error("DB smoke test FAILED:", err);
    process.exit(1);
  }
}

main();

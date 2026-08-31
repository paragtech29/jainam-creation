// The ONLY file in the codebase that constructs a Drizzle client.
// Uses the neon-serverless WebSocket/Pool driver (transaction-capable),
// NOT the HTTP driver, because Phase 3's atomic JobWork + JobWorkParticular
// insert requires db.transaction(), which the HTTP driver cannot do.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Required in Node.js runtimes (browsers have native WebSocket, Node.js does
// not). Defensive: empirically verified (01-01 smoke test) that
// @neondatabase/serverless 1.1.0 auto-detects Node.js and connects fine
// without this line on Node 24, but it is kept as a no-op safety net in
// case that auto-detection ever changes or the app runs on an older runtime.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });

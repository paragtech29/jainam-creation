// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for Party. Create/update belong to Phase 2 — out of scope here.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { parties, type Party } from "@/lib/db/schema";

export async function listParties(userId: string): Promise<Party[]> {
  return db
    .select()
    .from(parties)
    .where(and(eq(parties.userId, userId), eq(parties.isArchived, false)));
}

export async function getPartyById(userId: string, id: string): Promise<Party | null> {
  const [row] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, id), eq(parties.userId, userId)));
  return row ?? null;
}

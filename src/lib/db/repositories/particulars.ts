// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for Particular. Create/update belong to Phase 3 — out of scope here.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { particulars, type Particular } from "@/lib/db/schema";

export async function listParticulars(userId: string): Promise<Particular[]> {
  return db
    .select()
    .from(particulars)
    .where(and(eq(particulars.userId, userId), eq(particulars.isArchived, false)));
}

export async function getParticularById(userId: string, id: string): Promise<Particular | null> {
  const [row] = await db
    .select()
    .from(particulars)
    .where(and(eq(particulars.id, id), eq(particulars.userId, userId)));
  return row ?? null;
}

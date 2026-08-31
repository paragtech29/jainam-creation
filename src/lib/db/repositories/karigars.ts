// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for SilaiKarigar. Create/update belong to Phase 2 — out of scope here.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { silaiKarigars, type SilaiKarigar } from "@/lib/db/schema";

export async function listKarigars(userId: string): Promise<SilaiKarigar[]> {
  return db
    .select()
    .from(silaiKarigars)
    .where(and(eq(silaiKarigars.userId, userId), eq(silaiKarigars.isArchived, false)));
}

export async function getKarigarById(userId: string, id: string): Promise<SilaiKarigar | null> {
  const [row] = await db
    .select()
    .from(silaiKarigars)
    .where(and(eq(silaiKarigars.id, id), eq(silaiKarigars.userId, userId)));
  return row ?? null;
}

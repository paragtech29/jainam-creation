// Real (not stubbed) repository for SilaiKarigar, enforcing userId-scoping
// per docs/DATA-ACCESS.md. Every function that touches business data takes
// userId as its mandatory first parameter.
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  silaiKarigars,
  partyKarigars,
  jobWorks,
  type SilaiKarigar,
  type NewSilaiKarigar,
} from "@/lib/db/schema";

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

// Single aggregated query — one LEFT JOIN + GROUP BY, no N+1.
export async function listKarigarsWithJobWorkCounts(userId: string, includeArchived = false) {
  return db
    .select({
      id: silaiKarigars.id,
      name: silaiKarigars.name,
      contact1: silaiKarigars.contact1,
      isArchived: silaiKarigars.isArchived,
      jobWorkCount: sql<number>`count(${jobWorks.id})::int`,
    })
    .from(silaiKarigars)
    .leftJoin(jobWorks, eq(jobWorks.karigarId, silaiKarigars.id))
    .where(
      and(
        eq(silaiKarigars.userId, userId),
        includeArchived ? undefined : eq(silaiKarigars.isArchived, false)
      )
    )
    .groupBy(silaiKarigars.id)
    .orderBy(silaiKarigars.name);
}

// Case-insensitive match for the warn-but-allow duplicate-name check.
export async function findKarigarsByName(userId: string, name: string): Promise<SilaiKarigar[]> {
  return db
    .select()
    .from(silaiKarigars)
    .where(and(eq(silaiKarigars.userId, userId), sql`lower(${silaiKarigars.name}) = lower(${name})`));
}

export async function createKarigar(
  userId: string,
  data: Omit<NewSilaiKarigar, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<SilaiKarigar> {
  const [row] = await db
    .insert(silaiKarigars)
    .values({ userId, ...data })
    .returning();
  return row;
}

export async function updateKarigar(
  userId: string,
  id: string,
  data: Partial<Omit<NewSilaiKarigar, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<SilaiKarigar | null> {
  const [row] = await db
    .update(silaiKarigars)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(silaiKarigars.id, id), eq(silaiKarigars.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveKarigar(userId: string, id: string): Promise<SilaiKarigar | null> {
  const [row] = await db
    .update(silaiKarigars)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(silaiKarigars.id, id), eq(silaiKarigars.userId, userId)))
    .returning();
  return row ?? null;
}

export async function unarchiveKarigar(userId: string, id: string): Promise<SilaiKarigar | null> {
  const [row] = await db
    .update(silaiKarigars)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(and(eq(silaiKarigars.id, id), eq(silaiKarigars.userId, userId)))
    .returning();
  return row ?? null;
}

export async function countKarigarJobWorks(userId: string, karigarId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobWorks)
    .where(and(eq(jobWorks.userId, userId), eq(jobWorks.karigarId, karigarId)));
  return row?.count ?? 0;
}

// Delete is refused server-side if the karigar has any job works — belt
// and braces against the FK constraint (jobWorks.karigarId has NO
// onDelete cascade). Re-check happens INSIDE this function.
export async function deleteKarigar(
  userId: string,
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const count = await countKarigarJobWorks(userId, id);
  if (count > 0) {
    return { ok: false, reason: "This karigar has job works and cannot be deleted. Archive it instead." };
  }
  await db.delete(silaiKarigars).where(and(eq(silaiKarigars.id, id), eq(silaiKarigars.userId, userId)));
  return { ok: true };
}

// Read-only display of which parties this karigar serves — link
// MANAGEMENT lives on the party screen only (locked user decision); this
// is only used to render a list on the karigar's own detail page.
export async function listPartyIdsForKarigar(userId: string, karigarId: string): Promise<string[]> {
  const karigar = await getKarigarById(userId, karigarId);
  if (!karigar) throw new Error("Karigar not found");

  const links = await db
    .select({ partyId: partyKarigars.partyId })
    .from(partyKarigars)
    .where(eq(partyKarigars.karigarId, karigarId));

  return links.map((l) => l.partyId);
}

// For the karigar-create-form's party picker convenience field, and any
// future "add karigar not yet linked to this party" flow — karigars NOT
// yet linked to a given party.
export async function listKarigarsNotLinkedToParty(userId: string, partyId: string): Promise<SilaiKarigar[]> {
  const linked = await db
    .select({ karigarId: partyKarigars.karigarId })
    .from(partyKarigars)
    .where(eq(partyKarigars.partyId, partyId));

  const linkedIds = linked.map((l) => l.karigarId);

  return db
    .select()
    .from(silaiKarigars)
    .where(
      and(
        eq(silaiKarigars.userId, userId),
        eq(silaiKarigars.isArchived, false),
        linkedIds.length > 0 ? notInArray(silaiKarigars.id, linkedIds) : undefined
      )
    )
    .orderBy(silaiKarigars.name);
}

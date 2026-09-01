// Real (not stubbed) repository for Party, enforcing userId-scoping per
// docs/DATA-ACCESS.md. Every function that touches business data takes
// userId as its mandatory first parameter.
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { parties, partyKarigars, silaiKarigars, jobWorks, type Party, type NewParty } from "@/lib/db/schema";

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

// Single aggregated query — one LEFT JOIN + GROUP BY, no N+1. Powers the
// list's per-row "may I show Delete?" decision. Search and pagination happen
// in SQL, not in JS, so the page stays fast as the register grows.
export type PartyListRow = {
  id: string;
  name: string;
  ownerName1: string;
  contact1: string | null;
  isArchived: boolean;
  jobWorkCount: number;
};

export async function listPartiesPage(
  userId: string,
  opts: {
    search?: string;
    includeArchived?: boolean;
    // archivedOnly narrows to JUST the archived rows, for the "Archived"
    // choice in the list filter. includeArchived alone means "Active + Archived".
    archivedOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ rows: PartyListRow[]; total: number }> {
  const { search = "", includeArchived = false, archivedOnly = false, page = 1, pageSize = 20 } = opts;
  const term = search.trim();

  const where = and(
    eq(parties.userId, userId),
    archivedOnly
      ? eq(parties.isArchived, true)
      : includeArchived
        ? undefined
        : eq(parties.isArchived, false),
    term
      ? or(
          ilike(parties.name, `%${term}%`),
          ilike(parties.ownerName1, `%${term}%`),
          ilike(parties.ownerName2, `%${term}%`),
          ilike(parties.contact1, `%${term}%`)
        )
      : undefined
  );

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: parties.id,
        name: parties.name,
        ownerName1: parties.ownerName1,
        contact1: parties.contact1,
        isArchived: parties.isArchived,
        jobWorkCount: sql<number>`count(${jobWorks.id})::int`,
      })
      .from(parties)
      .leftJoin(jobWorks, eq(jobWorks.partyId, parties.id))
      .where(where)
      .groupBy(parties.id)
      .orderBy(asc(parties.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(parties)
      .where(where),
  ]);

  return { rows, total: count };
}

// Case-insensitive match for the warn-but-allow duplicate-name check.
export async function findPartiesByName(userId: string, name: string): Promise<Party[]> {
  return db
    .select()
    .from(parties)
    .where(and(eq(parties.userId, userId), sql`lower(${parties.name}) = lower(${name})`));
}

export async function createParty(
  userId: string,
  data: Omit<NewParty, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<Party> {
  const [row] = await db
    .insert(parties)
    .values({ userId, ...data })
    .returning();
  return row;
}

export async function updateParty(
  userId: string,
  id: string,
  data: Partial<Omit<NewParty, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<Party | null> {
  const [row] = await db
    .update(parties)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(parties.id, id), eq(parties.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveParty(userId: string, id: string): Promise<Party | null> {
  const [row] = await db
    .update(parties)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(parties.id, id), eq(parties.userId, userId)))
    .returning();
  return row ?? null;
}

export async function unarchiveParty(userId: string, id: string): Promise<Party | null> {
  const [row] = await db
    .update(parties)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(and(eq(parties.id, id), eq(parties.userId, userId)))
    .returning();
  return row ?? null;
}

export async function countPartyJobWorks(userId: string, partyId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobWorks)
    .where(and(eq(jobWorks.userId, userId), eq(jobWorks.partyId, partyId)));
  return row?.count ?? 0;
}

// Delete is refused server-side if the party has any job works — belt and
// braces against the FK constraint (jobWorks.partyId has NO onDelete
// cascade) firing when a job work is created between page render and
// submit. Re-check happens INSIDE this function, not just in the UI.
export async function deleteParty(
  userId: string,
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const count = await countPartyJobWorks(userId, id);
  if (count > 0) {
    return { ok: false, reason: "This party has job works and cannot be deleted. Archive it instead." };
  }
  await db.delete(parties).where(and(eq(parties.id, id), eq(parties.userId, userId)));
  return { ok: true };
}

export async function getPartyWithKarigars(
  userId: string,
  id: string
): Promise<(Party & { karigarIds: string[] }) | null> {
  const party = await getPartyById(userId, id);
  if (!party) return null;

  const links = await db
    .select({ karigarId: partyKarigars.karigarId })
    .from(partyKarigars)
    .where(eq(partyKarigars.partyId, id));

  return { ...party, karigarIds: links.map((l) => l.karigarId) };
}

// Whole-set replace (party detail checkbox list) vs. addKarigarToParty
// (single additive insert, e.g. karigar-create-form's convenience picker
// or Phase 3's inline "no karigars linked yet" flow) are two genuinely
// different operations — kept as two separate functions, not one mode flag.
//
// Delete-then-bulk-insert, never an added/removed diff: the composite PK
// (partyId, karigarId) makes a naive re-insert of an already-linked pair
// throw. Ownership of the party AND the submitted karigarIds is
// re-verified — never trust client-submitted ids.
export async function replacePartyKarigarLinks(
  userId: string,
  partyId: string,
  karigarIds: string[]
): Promise<void> {
  const party = await getPartyById(userId, partyId);
  if (!party) throw new Error("Party not found");

  await db.transaction(async (tx) => {
    await tx.delete(partyKarigars).where(eq(partyKarigars.partyId, partyId));

    if (karigarIds.length > 0) {
      const owned = await tx
        .select({ id: silaiKarigars.id })
        .from(silaiKarigars)
        .where(and(eq(silaiKarigars.userId, userId), inArray(silaiKarigars.id, karigarIds)));

      if (owned.length > 0) {
        await tx.insert(partyKarigars).values(owned.map((k) => ({ partyId, karigarId: k.id })));
      }
    }
  });
}

// Single additive link — idempotent via onConflictDoNothing. See comment
// above replacePartyKarigarLinks for why this stays a separate function.
export async function addKarigarToParty(userId: string, partyId: string, karigarId: string): Promise<void> {
  const party = await getPartyById(userId, partyId);
  if (!party) throw new Error("Party not found");

  const [karigar] = await db
    .select({ id: silaiKarigars.id })
    .from(silaiKarigars)
    .where(and(eq(silaiKarigars.id, karigarId), eq(silaiKarigars.userId, userId)));
  if (!karigar) throw new Error("Karigar not found");

  await db.insert(partyKarigars).values({ partyId, karigarId }).onConflictDoNothing();
}

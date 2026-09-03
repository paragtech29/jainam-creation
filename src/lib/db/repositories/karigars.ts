// Real (not stubbed) repository for SilaiKarigar, enforcing userId-scoping
// per docs/DATA-ACCESS.md. Every function that touches business data takes
// userId as its mandatory first parameter.
import { and, asc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  silaiKarigars,
  partyKarigars,
  parties,
  jobWorks,
  type SilaiKarigar,
  type NewSilaiKarigar,
} from "@/lib/db/schema";

// Re-exported so consumers (e.g. karigar-form.tsx) can type against the
// entity without importing @/lib/db/schema directly, which ESLint bans
// outside repository modules.
export type { SilaiKarigar } from "@/lib/db/schema";

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
export type KarigarListRow = {
  id: string;
  name: string;
  // As with parties: enough to open the edit dialog from the row itself.
  address: string | null;
  contact1: string | null;
  contact2: string | null;
  isArchived: boolean;
  jobWorkCount: number;
  partyCount: number;
};

export async function listKarigarsPage(
  userId: string,
  opts: {
    search?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ rows: KarigarListRow[]; total: number }> {
  const { search = "", includeArchived = false, archivedOnly = false, page = 1, pageSize = 10 } = opts;
  const term = search.trim();

  const where = and(
    eq(silaiKarigars.userId, userId),
    archivedOnly
      ? eq(silaiKarigars.isArchived, true)
      : includeArchived
        ? undefined
        : eq(silaiKarigars.isArchived, false),
    term
      ? or(
          ilike(silaiKarigars.name, `%${term}%`),
          ilike(silaiKarigars.contact1, `%${term}%`),
          ilike(silaiKarigars.address, `%${term}%`)
        )
      : undefined
  );

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: silaiKarigars.id,
        name: silaiKarigars.name,
        address: silaiKarigars.address,
        contact1: silaiKarigars.contact1,
        contact2: silaiKarigars.contact2,
        isArchived: silaiKarigars.isArchived,
        jobWorkCount: sql<number>`count(distinct ${jobWorks.id})::int`,
        partyCount: sql<number>`count(distinct ${partyKarigars.partyId})::int`,
      })
      .from(silaiKarigars)
      .leftJoin(jobWorks, eq(jobWorks.karigarId, silaiKarigars.id))
      .leftJoin(partyKarigars, eq(partyKarigars.karigarId, silaiKarigars.id))
      .where(where)
      .groupBy(silaiKarigars.id)
      .orderBy(asc(silaiKarigars.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(silaiKarigars)
      .where(where),
  ]);

  return { rows, total: count };
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

// All karigar-to-party links for this user, in one query — the job work
// form loads this whole set once (scale is ~20 karigars) and filters the
// karigar dropdown client-side on party change, no server round trip per
// party pick. The join through silaiKarigars is REQUIRED: party_karigars
// has no userId column of its own, so selecting from it alone would escape
// user scoping (same reasoning as countDescriptionTypeUsages in
// description-types.ts / countParticularUsages pattern). Archived karigars
// are excluded — they should not appear in the dropdown at all.
export async function listKarigarPartyLinks(
  userId: string
): Promise<{ karigarId: string; partyId: string }[]> {
  return db
    .select({ karigarId: partyKarigars.karigarId, partyId: partyKarigars.partyId })
    .from(partyKarigars)
    .innerJoin(silaiKarigars, eq(silaiKarigars.id, partyKarigars.karigarId))
    .where(and(eq(silaiKarigars.userId, userId), eq(silaiKarigars.isArchived, false)));
}

// Mirror of replacePartyKarigarLinks, from the karigar's side. Linking is now
// managed on the karigar form, so this is the primary write path for the
// relationship. Wrapped in a transaction: a half-saved party set would leave
// the karigar offered for some parties and not others, silently.
export async function replaceKarigarPartyLinks(
  userId: string,
  karigarId: string,
  partyIds: string[]
): Promise<void> {
  const karigar = await getKarigarById(userId, karigarId);
  if (!karigar) throw new Error("Karigar not found");

  await db.transaction(async (tx) => {
    await tx.delete(partyKarigars).where(eq(partyKarigars.karigarId, karigarId));

    if (partyIds.length > 0) {
      // Re-check ownership inside the transaction so a forged party id from a
      // form post can never link this karigar to someone else's party.
      const owned = await tx
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.userId, userId), inArray(parties.id, partyIds)));

      if (owned.length > 0) {
        await tx
          .insert(partyKarigars)
          .values(owned.map((p) => ({ partyId: p.id, karigarId })));
      }
    }
  });
}

// Real (not stubbed) repository for Particular, enforcing userId-scoping
// per docs/DATA-ACCESS.md. Every function that touches business data takes
// userId as its mandatory first parameter.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { particulars, jobWorkParticulars, jobWorks, type Particular, type NewParticular } from "@/lib/db/schema";

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

// Single aggregated query — one LEFT JOIN + GROUP BY, no N+1.
export async function listParticularsWithUsageCounts(userId: string, includeArchived = false) {
  return db
    .select({
      id: particulars.id,
      name: particulars.name,
      defaultPrice: particulars.defaultPrice,
      isArchived: particulars.isArchived,
      usageCount: sql<number>`count(${jobWorkParticulars.jobWorkId})::int`,
    })
    .from(particulars)
    .leftJoin(jobWorkParticulars, eq(jobWorkParticulars.particularId, particulars.id))
    .where(
      and(
        eq(particulars.userId, userId),
        includeArchived ? undefined : eq(particulars.isArchived, false)
      )
    )
    .groupBy(particulars.id)
    .orderBy(particulars.name);
}

export async function createParticular(
  userId: string,
  data: Omit<NewParticular, "id" | "userId" | "createdAt">
): Promise<Particular> {
  const [row] = await db
    .insert(particulars)
    .values({ userId, ...data })
    .returning();
  return row;
}

// NOTE: the particulars table intentionally has NO updatedAt column
// (verified in schema.ts — only createdAt exists). Do not add
// `updatedAt: new Date()` here; it will not typecheck. This is not an
// oversight against DATA-ACCESS.md's "updatedAt does not auto-bump"
// note — particulars simply never got that column.
export async function updateParticular(
  userId: string,
  id: string,
  data: Partial<Omit<NewParticular, "id" | "userId" | "createdAt">>
): Promise<Particular | null> {
  const [row] = await db
    .update(particulars)
    .set({ ...data })
    .where(and(eq(particulars.id, id), eq(particulars.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveParticular(userId: string, id: string): Promise<Particular | null> {
  const [row] = await db
    .update(particulars)
    .set({ isArchived: true })
    .where(and(eq(particulars.id, id), eq(particulars.userId, userId)))
    .returning();
  return row ?? null;
}

export async function unarchiveParticular(userId: string, id: string): Promise<Particular | null> {
  const [row] = await db
    .update(particulars)
    .set({ isArchived: false })
    .where(and(eq(particulars.id, id), eq(particulars.userId, userId)))
    .returning();
  return row ?? null;
}

// jobWorkParticulars has no userId column of its own, so the join through
// jobWorks is required to both determine usage AND stay inside user
// scoping — counting jobWorkParticulars alone would escape the scope filter.
export async function countParticularUsages(userId: string, particularId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobWorkParticulars)
    .innerJoin(jobWorks, eq(jobWorkParticulars.jobWorkId, jobWorks.id))
    .where(and(eq(jobWorks.userId, userId), eq(jobWorkParticulars.particularId, particularId)));
  return row?.count ?? 0;
}

// Delete is refused server-side if the particular has any usages — belt
// and braces re-check happens INSIDE this function.
export async function deleteParticular(
  userId: string,
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const count = await countParticularUsages(userId, id);
  if (count > 0) {
    return { ok: false, reason: "This particular has job works and cannot be deleted. Archive it instead." };
  }
  await db.delete(particulars).where(and(eq(particulars.id, id), eq(particulars.userId, userId)));
  return { ok: true };
}

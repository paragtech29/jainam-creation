// Real (not stubbed) repository for DescriptionType, enforcing userId-scoping
// per docs/DATA-ACCESS.md. Every function that touches business data takes
// userId as its mandatory first parameter.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { descriptionTypes, jobWorkDescriptions, jobWorks, type DescriptionType, type NewDescriptionType } from "@/lib/db/schema";

export async function listDescriptionTypes(userId: string): Promise<DescriptionType[]> {
  return db
    .select()
    .from(descriptionTypes)
    .where(and(eq(descriptionTypes.userId, userId), eq(descriptionTypes.isArchived, false)));
}

export async function getDescriptionTypeById(userId: string, id: string): Promise<DescriptionType | null> {
  const [row] = await db
    .select()
    .from(descriptionTypes)
    .where(and(eq(descriptionTypes.id, id), eq(descriptionTypes.userId, userId)));
  return row ?? null;
}

// Single aggregated query — one LEFT JOIN + GROUP BY, no N+1.
export async function listDescriptionTypesWithUsageCounts(userId: string, includeArchived = false) {
  return db
    .select({
      id: descriptionTypes.id,
      name: descriptionTypes.name,
      isArchived: descriptionTypes.isArchived,
      usageCount: sql<number>`count(${jobWorkDescriptions.jobWorkId})::int`,
    })
    .from(descriptionTypes)
    .leftJoin(jobWorkDescriptions, eq(jobWorkDescriptions.descriptionTypeId, descriptionTypes.id))
    .where(
      and(
        eq(descriptionTypes.userId, userId),
        includeArchived ? undefined : eq(descriptionTypes.isArchived, false)
      )
    )
    .groupBy(descriptionTypes.id)
    .orderBy(descriptionTypes.name);
}

export async function createDescriptionType(
  userId: string,
  data: Omit<NewDescriptionType, "id" | "userId" | "createdAt">
): Promise<DescriptionType> {
  const [row] = await db
    .insert(descriptionTypes)
    .values({ userId, ...data })
    .returning();
  return row;
}

// NOTE: the descriptionTypes table intentionally has NO updatedAt column
// (verified in schema.ts — only createdAt exists). Do not add
// `updatedAt: new Date()` here; it will not typecheck. This is not an
// oversight against DATA-ACCESS.md's "updatedAt does not auto-bump"
// note — descriptionTypes simply never got that column.
export async function updateDescriptionType(
  userId: string,
  id: string,
  data: Partial<Omit<NewDescriptionType, "id" | "userId" | "createdAt">>
): Promise<DescriptionType | null> {
  const [row] = await db
    .update(descriptionTypes)
    .set({ ...data })
    .where(and(eq(descriptionTypes.id, id), eq(descriptionTypes.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveDescriptionType(userId: string, id: string): Promise<DescriptionType | null> {
  const [row] = await db
    .update(descriptionTypes)
    .set({ isArchived: true })
    .where(and(eq(descriptionTypes.id, id), eq(descriptionTypes.userId, userId)))
    .returning();
  return row ?? null;
}

export async function unarchiveDescriptionType(userId: string, id: string): Promise<DescriptionType | null> {
  const [row] = await db
    .update(descriptionTypes)
    .set({ isArchived: false })
    .where(and(eq(descriptionTypes.id, id), eq(descriptionTypes.userId, userId)))
    .returning();
  return row ?? null;
}

// jobWorkDescriptions has no userId column of its own, so the join through
// jobWorks is required to both determine usage AND stay inside user
// scoping — counting jobWorkDescriptions alone would escape the scope filter.
export async function countDescriptionTypeUsages(userId: string, descriptionTypeId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobWorkDescriptions)
    .innerJoin(jobWorks, eq(jobWorkDescriptions.jobWorkId, jobWorks.id))
    .where(and(eq(jobWorks.userId, userId), eq(jobWorkDescriptions.descriptionTypeId, descriptionTypeId)));
  return row?.count ?? 0;
}

// Delete is refused server-side if the description type has any usages — belt
// and braces re-check happens INSIDE this function.
export async function deleteDescriptionType(
  userId: string,
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const count = await countDescriptionTypeUsages(userId, id);
  if (count > 0) {
    return { ok: false, reason: "This description type has job works and cannot be deleted. Archive it instead." };
  }
  await db.delete(descriptionTypes).where(and(eq(descriptionTypes.id, id), eq(descriptionTypes.userId, userId)));
  return { ok: true };
}

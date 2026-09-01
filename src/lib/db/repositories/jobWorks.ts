// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for JobWork. Create/update belong to Phase 3 — out of scope here.
// deleteJobWork demonstrates the "mismatched userId matches zero rows,
// never throws, never touches another user's row" principle.
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  jobWorks,
  jobWorkDescriptions,
  descriptionTypes,
  type JobWork,
  type NewJobWork,
} from "@/lib/db/schema";

// Re-exported so form components can type against the entity without
// importing @/lib/db/schema directly — ESLint bans that outside repository
// modules, and there is no type-only exemption (pattern established by
// karigars.ts).
export type { JobWork } from "@/lib/db/schema";

export type DescriptionLine = { descriptionTypeId: string; price: number };

export async function listJobWorks(userId: string): Promise<JobWork[]> {
  return db.select().from(jobWorks).where(eq(jobWorks.userId, userId));
}

export async function getJobWorkById(userId: string, id: string): Promise<JobWork | null> {
  const [row] = await db
    .select()
    .from(jobWorks)
    .where(and(eq(jobWorks.id, id), eq(jobWorks.userId, userId)));
  return row ?? null;
}

export async function deleteJobWork(userId: string, id: string) {
  // No manual delete of jobWorkDescriptions needed here: the FK has
  // onDelete: "cascade" (schema.ts), so deleting the job work already
  // removes its lines. Do not "fix" this by adding a manual delete.
  return db
    .delete(jobWorks)
    .where(and(eq(jobWorks.id, id), eq(jobWorks.userId, userId)));
}

// Atomic create: the job work row and every one of its description lines are
// written in ONE db.transaction(). Two un-transacted inserts are FORBIDDEN —
// a crash between them would leave a job work whose rate/total do not match
// its lines. priceUsed is a SNAPSHOT written once here and never
// recomputed, so renaming or archiving a description type later can never
// alter a saved job work's rate or total (JOB-06).
export async function createJobWork(
  userId: string,
  data: Omit<NewJobWork, "id" | "userId" | "createdAt" | "updatedAt">,
  lines: DescriptionLine[]
): Promise<JobWork> {
  return db.transaction(async (tx) => {
    const [jobWork] = await tx
      .insert(jobWorks)
      .values({ userId, ...data })
      .returning();

    if (lines.length > 0) {
      await tx.insert(jobWorkDescriptions).values(
        lines.map((l) => ({
          jobWorkId: jobWork.id,
          descriptionTypeId: l.descriptionTypeId,
          priceUsed: l.price,
        }))
      );
    }

    return jobWork;
  });
}

// Atomic update: replaces the job work row and its full set of description
// lines inside ONE transaction (delete-then-reinsert, same shape as
// replacePartyKarigarLinks / replaceKarigarPartyLinks). A wrong userId
// matches zero rows and returns null rather than throwing or touching
// another user's row.
//
// IMPORTANT: `data` must never include photo1Url/photo2Url unless the
// caller explicitly intends to change them — Phase 4 owns photos, and a
// partial update that omits those keys leaves the existing column values
// untouched (Drizzle's .set() only touches keys present in the object).
export async function updateJobWork(
  userId: string,
  id: string,
  data: Partial<Omit<NewJobWork, "id" | "userId" | "createdAt" | "updatedAt">>,
  lines: DescriptionLine[]
): Promise<JobWork | null> {
  return db.transaction(async (tx) => {
    const [jobWork] = await tx
      .update(jobWorks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(jobWorks.id, id), eq(jobWorks.userId, userId)))
      .returning();

    if (!jobWork) return null;

    await tx.delete(jobWorkDescriptions).where(eq(jobWorkDescriptions.jobWorkId, id));

    if (lines.length > 0) {
      await tx.insert(jobWorkDescriptions).values(
        lines.map((l) => ({
          jobWorkId: id,
          descriptionTypeId: l.descriptionTypeId,
          priceUsed: l.price,
        }))
      );
    }

    return jobWork;
  });
}

export type JobWorkWithDescriptions = JobWork & {
  lines: { id: string; descriptionTypeId: string; descriptionTypeName: string; priceUsed: number }[];
};

// Reuses getJobWorkById for userId scoping, then joins the description lines
// onto descriptionTypes so the edit form can show the type NAME even if that
// type was later archived. Ordered by jobWorkDescriptions.id so rows reload
// in a stable order across reads.
export async function getJobWorkWithDescriptions(
  userId: string,
  id: string
): Promise<JobWorkWithDescriptions | null> {
  const jobWork = await getJobWorkById(userId, id);
  if (!jobWork) return null;

  const lines = await db
    .select({
      id: jobWorkDescriptions.id,
      descriptionTypeId: jobWorkDescriptions.descriptionTypeId,
      descriptionTypeName: descriptionTypes.name,
      priceUsed: jobWorkDescriptions.priceUsed,
    })
    .from(jobWorkDescriptions)
    .innerJoin(descriptionTypes, eq(descriptionTypes.id, jobWorkDescriptions.descriptionTypeId))
    .where(eq(jobWorkDescriptions.jobWorkId, id))
    .orderBy(asc(jobWorkDescriptions.id));

  return { ...jobWork, lines };
}

// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for JobWork. Create/update belong to Phase 3 — out of scope here.
// deleteJobWork demonstrates the "mismatched userId matches zero rows,
// never throws, never touches another user's row" principle.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { jobWorks, type JobWork } from "@/lib/db/schema";

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
  return db
    .delete(jobWorks)
    .where(and(eq(jobWorks.id, id), eq(jobWorks.userId, userId)));
}

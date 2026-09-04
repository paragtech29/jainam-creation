// Minimal, REAL (not stubbed) repository establishing the userId-scoping
// pattern for JobWork. Create/update belong to Phase 3 — out of scope here.
// deleteJobWork demonstrates the "mismatched userId matches zero rows,
// never throws, never touches another user's row" principle.
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deleteImage } from "@/lib/db/repositories/images";
import {
  jobWorks,
  jobWorkDescriptions,
  descriptionTypes,
  parties,
  silaiKarigars,
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
  // Photos first. Their FK is ON DELETE SET NULL — losing an image must never
  // delete a job work — so nothing removes them automatically, and without
  // this their bytes stay in the database with nothing pointing at them.
  const [row] = await db
    .select({ p1: jobWorks.photo1ImageId, p2: jobWorks.photo2ImageId })
    .from(jobWorks)
    .where(and(eq(jobWorks.userId, userId), eq(jobWorks.id, id)))
    .limit(1);
  if (row?.p1) await deleteImage(userId, row.p1);
  if (row?.p2) await deleteImage(userId, row.p2);

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

// Single aggregated query for the job work list screen. Modeled directly on
// listKarigarsPage/listPartiesPage: one Promise.all([rowsQuery, countQuery]),
// same limit/offset arithmetic. Deliberately NO status filter, NO archived
// toggle, NO date-range filter — those are Phase 5 scope.
export type JobWorkListRow = {
  id: string;
  date: string;
  partyName: string;
  karigarName: string;
  chalanNo: string | null;
  partyDesignNo: string | null;
  pieces: number;
  rate: number;
  total: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  isBilled: boolean;
};

/**
 * Everything the dashboard shows for ONE month, aggregated in SQL.
 *
 * The dashboard previously pulled up to 1000 rows and added them up in
 * JavaScript, which is both wrong at scale and silently wrong past the page
 * size — the 1001st job work would just not count. Postgres does the sums.
 *
 * `from`/`to` are inclusive YYYY-MM-DD strings. Status amounts are the
 * owner's asked-for breakup: what is still pending, what is finished but not
 * invoiced, and what has been billed. They are amounts, not counts, because
 * "how much" is the question the dashboard exists to answer.
 */
export type MonthSummary = {
  total: number;
  count: number;
  pendingTotal: number;
  inProgressTotal: number;
  /** COMPLETED and not yet billed — the money still to invoice. */
  toInvoiceTotal: number;
  billedTotal: number;
  byParty: { partyId: string; partyName: string; total: number; count: number }[];
};

export async function getMonthSummary(
  userId: string,
  from: string,
  to: string
): Promise<MonthSummary> {
  const inMonth = and(
    eq(jobWorks.userId, userId),
    gte(jobWorks.date, from),
    lte(jobWorks.date, to)
  );

  const [totals] = await db
    .select({
      total: sql<number>`coalesce(sum(${jobWorks.total}), 0)::int`,
      count: sql<number>`count(*)::int`,
      pendingTotal: sql<number>`coalesce(sum(${jobWorks.total}) filter (where ${jobWorks.status} = 'PENDING'), 0)::int`,
      inProgressTotal: sql<number>`coalesce(sum(${jobWorks.total}) filter (where ${jobWorks.status} = 'IN_PROGRESS'), 0)::int`,
      toInvoiceTotal: sql<number>`coalesce(sum(${jobWorks.total}) filter (where ${jobWorks.status} = 'COMPLETED' and ${jobWorks.isBilled} = false), 0)::int`,
      billedTotal: sql<number>`coalesce(sum(${jobWorks.total}) filter (where ${jobWorks.isBilled} = true), 0)::int`,
    })
    .from(jobWorks)
    .where(inMonth);

  // partyId comes back too, so the dashboard figure can link straight to the
  // job work list filtered to that party and month.
  const byParty = await db
    .select({
      partyId: parties.id,
      partyName: parties.name,
      total: sql<number>`coalesce(sum(${jobWorks.total}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(jobWorks)
    .innerJoin(parties, eq(parties.id, jobWorks.partyId))
    .where(inMonth)
    .groupBy(parties.id, parties.name)
    .orderBy(desc(sql`sum(${jobWorks.total})`));

  return {
    total: totals?.total ?? 0,
    count: totals?.count ?? 0,
    pendingTotal: totals?.pendingTotal ?? 0,
    inProgressTotal: totals?.inProgressTotal ?? 0,
    toInvoiceTotal: totals?.toInvoiceTotal ?? 0,
    billedTotal: totals?.billedTotal ?? 0,
    byParty,
  };
}

/** The earliest and latest job work dates, for bounding the month picker. */
export async function getJobWorkDateRange(
  userId: string
): Promise<{ first: string | null; last: string | null }> {
  const [r] = await db
    .select({
      first: sql<string | null>`min(${jobWorks.date})::text`,
      last: sql<string | null>`max(${jobWorks.date})::text`,
    })
    .from(jobWorks)
    .where(eq(jobWorks.userId, userId));
  return { first: r?.first ?? null, last: r?.last ?? null };
}

export async function listJobWorksPage(
  userId: string,
  opts: {
    search?: string;
    // The owner's filter panel. Every one is optional; an absent value means
    // "no constraint", never a silent default.
    from?: string;
    to?: string;
    partyId?: string;
    karigarId?: string;
    status?: string;
    billed?: "yes" | "no";
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ rows: JobWorkListRow[]; total: number; grandTotal: number }> {
  const { search = "", from, to, partyId, karigarId, status, billed, page = 1, pageSize = 10 } = opts;
  const term = search.trim();

  const where = and(
    eq(jobWorks.userId, userId),
    from ? gte(jobWorks.date, from) : undefined,
    to ? lte(jobWorks.date, to) : undefined,
    partyId ? eq(jobWorks.partyId, partyId) : undefined,
    karigarId ? eq(jobWorks.karigarId, karigarId) : undefined,
    status ? eq(jobWorks.status, status as "PENDING" | "IN_PROGRESS" | "COMPLETED") : undefined,
    billed === "yes" ? eq(jobWorks.isBilled, true) : billed === "no" ? eq(jobWorks.isBilled, false) : undefined,
    term
      ? or(
          ilike(jobWorks.chalanNo, `%${term}%`),
          ilike(jobWorks.partyDesignNo, `%${term}%`),
          ilike(jobWorks.computerDesignNo, `%${term}%`),
          ilike(parties.name, `%${term}%`),
          ilike(silaiKarigars.name, `%${term}%`)
        )
      : undefined
  );

  const [rows, [{ count, sum }]] = await Promise.all([
    db
      .select({
        id: jobWorks.id,
        date: jobWorks.date,
        partyName: parties.name,
        karigarName: silaiKarigars.name,
        chalanNo: jobWorks.chalanNo,
        partyDesignNo: jobWorks.partyDesignNo,
        pieces: jobWorks.pieces,
        rate: jobWorks.rate,
        total: jobWorks.total,
        status: jobWorks.status,
        isBilled: jobWorks.isBilled,
      })
      .from(jobWorks)
      .innerJoin(parties, eq(parties.id, jobWorks.partyId))
      .innerJoin(silaiKarigars, eq(silaiKarigars.id, jobWorks.karigarId))
      .where(where)
      .orderBy(desc(jobWorks.date), desc(jobWorks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        count: sql<number>`count(*)::int`,
        // Summed in SQL over the WHOLE filtered set, not just this page —
        // a total that only counted the visible rows would be quietly wrong.
        sum: sql<number>`coalesce(sum(${jobWorks.total}), 0)::int`,
      })
      .from(jobWorks)
      .innerJoin(parties, eq(parties.id, jobWorks.partyId))
      .innerJoin(silaiKarigars, eq(silaiKarigars.id, jobWorks.karigarId))
      .where(where),
  ]);

  return { rows, total: count, grandTotal: sum };
}

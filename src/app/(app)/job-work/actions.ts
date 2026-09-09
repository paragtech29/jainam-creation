"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { saveUploadedImage } from "@/lib/save-uploaded-image";
import { jobWorkSchema, computeTotal } from "@/lib/validation/job-work";
import { descriptionTypeSchema } from "@/lib/validation/description-type";
import {
  createJobWork,
  updateJobWork,
  deleteJobWork,
  getJobWorkById,
  setJobWorkProgress,
} from "@/lib/db/repositories/jobWorks";
import {
  createDescriptionType,
  listDescriptionTypes,
} from "@/lib/db/repositories/description-types";

export type JobWorkFormState =
  | {
      error?: string;
      fieldErrors?: Partial<
        Record<
          | "date"
          | "partyId"
          | "karigarId"
          | "pieces"
          | "rate"
          | "chalanNo"
          | "partyDesignNo"
          | "computerDesignNo"
          | "comment"
          | "status"
          | "lines",
          string
        >
      >;
      success?: boolean;
      newId?: string;
    }
  | undefined;

export type InlineDescriptionTypeState =
  | { error?: string; descriptionType?: { id: string; name: string } }
  | undefined;

// Reads the paired description-line arrays. Radix <Select name="..."> posts
// natively into FormData (see top-of-file comment in job-work.ts) — there is
// no hidden mirror, so getAll returns exactly N entries for N rows. Never use
// Object.fromEntries for these two fields; it collapses repeats to one value.
function readDescriptionLines(formData: FormData) {
  const typeIds = formData.getAll("descriptionTypeId").map(String);
  const rawPrices = formData.getAll("price").map(String);
  const lines = typeIds
    .map((descriptionTypeId, i) => ({ descriptionTypeId, price: rawPrices[i] ?? "" }))
    .filter((l) => l.descriptionTypeId.trim() !== "" && l.price.trim() !== "");
  return { typeIds, rawPrices, lines };
}

export async function createJobWorkAction(
  _prevState: JobWorkFormState,
  formData: FormData
): Promise<JobWorkFormState> {
  const userId = await getCurrentUserId();

  const { typeIds, rawPrices, lines } = readDescriptionLines(formData);
  if (typeIds.length !== rawPrices.length) {
    // A length mismatch means the row/price pairing is untrustworthy —
    // guessing here would silently attach a price to the wrong kind of work.
    return { error: "Description rows did not submit correctly. Reload the form and try again." };
  }

  const parsed = jobWorkSchema.safeParse({ ...Object.fromEntries(formData), lines });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        date: flattened.date?.[0],
        partyId: flattened.partyId?.[0],
        karigarId: flattened.karigarId?.[0],
        pieces: flattened.pieces?.[0],
        rate: flattened.rate?.[0],
        chalanNo: flattened.chalanNo?.[0],
        partyDesignNo: flattened.partyDesignNo?.[0],
        computerDesignNo: flattened.computerDesignNo?.[0],
        comment: flattened.comment?.[0],
        status: flattened.status?.[0],
        lines: flattened.lines?.[0],
      },
    };
  }

  const {
    date,
    partyId,
    karigarId,
    pieces,
    rate,
    chalanNo,
    partyDesignNo,
    computerDesignNo,
    comment,
    status,
  } = parsed.data;

  // computeTotal is the ONLY place a total is derived — the server never
  // reads a posted total. formData.get("total") is never read. Ever. Do not
  // add it later.
  const total = computeTotal(pieces, rate);

  const photo1 = await saveUploadedImage(userId, formData, "photo1", null);
  if (photo1.error) return { error: photo1.error };
  const photo2 = await saveUploadedImage(userId, formData, "photo2", null);
  if (photo2.error) return { error: photo2.error };

  const jobWork = await createJobWork(
    userId,
    {
      date,
      partyId,
      karigarId,
      pieces,
      rate,
      total,
      chalanNo: chalanNo || null,
      partyDesignNo: partyDesignNo || null,
      computerDesignNo: computerDesignNo || null,
      comment: comment || null,
      status,
      // The photos. These were stored by saveUploadedImage above and then
      // NEVER attached here, so every photo added to a NEW job work was
      // silently discarded while its bytes stayed in the images table as an
      // orphan. The update action had it right (photo1ImageId/photo2ImageId);
      // create simply omitted them. Found by driving a real save rather than
      // by reading the form, which is why it survived since the photo work.
      photo1ImageId: photo1.imageId,
      photo2ImageId: photo2.imageId,
      // A brand-new job work is never already billed — the locked rule
      // requires COMPLETED first, and creation always starts un-billed.
      isBilled: false,
    },
    parsed.data.lines
  );

  revalidatePath("/job-work");
  return { success: true, newId: jobWork.id };
}

export async function updateJobWorkAction(
  jobWorkId: string,
  _prevState: JobWorkFormState,
  formData: FormData
): Promise<JobWorkFormState> {
  const userId = await getCurrentUserId();

  const { typeIds, rawPrices, lines } = readDescriptionLines(formData);
  if (typeIds.length !== rawPrices.length) {
    return { error: "Description rows did not submit correctly. Reload the form and try again." };
  }

  const parsed = jobWorkSchema.safeParse({ ...Object.fromEntries(formData), lines });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        date: flattened.date?.[0],
        partyId: flattened.partyId?.[0],
        karigarId: flattened.karigarId?.[0],
        pieces: flattened.pieces?.[0],
        rate: flattened.rate?.[0],
        chalanNo: flattened.chalanNo?.[0],
        partyDesignNo: flattened.partyDesignNo?.[0],
        computerDesignNo: flattened.computerDesignNo?.[0],
        comment: flattened.comment?.[0],
        status: flattened.status?.[0],
        lines: flattened.lines?.[0],
      },
    };
  }

  const {
    date,
    partyId,
    karigarId,
    pieces,
    rate,
    chalanNo,
    partyDesignNo,
    computerDesignNo,
    comment,
    status,
  } = parsed.data;

  const total = computeTotal(pieces, rate);

  // Is Billed gating, server-side (JOB-09). The switch is disabled in the DOM
  // when status is not COMPLETED, but a disabled input posting nothing is a
  // UI affordance, not a control — enforce independently here. Return an
  // explicit error rather than silently coercing to false: the owner may
  // have genuinely meant to bill something he had not yet marked complete,
  // and he deserves to be told why it did not stick.
  const wantsBilled = parsed.data.isBilled === true;
  if (wantsBilled && status !== "COMPLETED") {
    return { error: "A job work can only be marked Billed once its status is Completed." };
  }
  const isBilled = wantsBilled;

  // The existing ids matter twice over: a replacement must delete the image
  // it replaced, and an untouched field must keep what is already there.
  const current = await getJobWorkById(userId, jobWorkId);
  const newPhoto1 = await saveUploadedImage(userId, formData, "photo1", current?.photo1ImageId);
  if (newPhoto1.error) return { error: newPhoto1.error };
  const newPhoto2 = await saveUploadedImage(userId, formData, "photo2", current?.photo2ImageId);
  if (newPhoto2.error) return { error: newPhoto2.error };

  const jobWork = await updateJobWork(
    userId,
    jobWorkId,
    {
      photo1ImageId: newPhoto1.imageId,
      photo2ImageId: newPhoto2.imageId,
      date,
      partyId,
      karigarId,
      pieces,
      rate,
      total,
      chalanNo: chalanNo || null,
      partyDesignNo: partyDesignNo || null,
      computerDesignNo: computerDesignNo || null,
      comment: comment || null,
      status,
      isBilled,
    },
    parsed.data.lines
  );

  if (!jobWork) return { error: "That job work no longer exists." };

  // Revalidate BOTH routes — revalidating only the detail route leaves the
  // list showing the stale old total (the mistake updatePartyAction already
  // documents).
  revalidatePath("/job-work");
  revalidatePath(`/job-work/${jobWorkId}`);

  return { success: true, newId: jobWorkId };
}

export async function deleteJobWorkAction(
  jobWorkId: string
): Promise<{ error: string } | void> {
  const userId = await getCurrentUserId();

  // A job work is a leaf record — unlike parties and karigars there is no
  // "cannot delete, it has dependents" rule. Deletion is always allowed; the
  // description lines go with it via the onDelete: "cascade" already on
  // jobWorkDescriptions.jobWorkId. Confirmation is UI-side (03-06).
  await deleteJobWork(userId, jobWorkId);

  revalidatePath("/job-work");
  // redirect() throws a NEXT_REDIRECT error by design — do not wrap this in
  // try/catch (the exact trap src/app/login/actions.ts already documents).
  redirect("/job-work");
}

// PART-02/PART-03: creates a description type inline, from inside a
// half-filled job work form, with zero navigation. Must NOT redirect, must
// NOT revalidatePath, and must NOT return success-style navigation state —
// the caller is a client overlay, and any navigation would destroy exactly
// what PART-03 promises not to destroy.
export async function createDescriptionTypeInlineAction(
  _prevState: InlineDescriptionTypeState,
  formData: FormData
): Promise<InlineDescriptionTypeState> {
  const userId = await getCurrentUserId();

  const parsed = descriptionTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Please check the name and try again." };
  }
  const { name } = parsed.data;

  // Duplicates are BLOCKED, never warned — the (userId, name) unique index
  // in schema.ts guarantees it. Pre-check case-insensitively as the primary
  // path, and catch a Postgres 23505 unique violation as a belt-and-braces
  // second line. No raw Postgres error text may ever reach the UI.
  const existing = await listDescriptionTypes(userId);
  const duplicate = existing.find((dt) => dt.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return { error: `A description type named "${name}" already exists — pick it from the list instead.` };
  }

  try {
    const descriptionType = await createDescriptionType(userId, { name, isArchived: false });
    return { descriptionType: { id: descriptionType.id, name: descriptionType.name } };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return { error: `A description type named "${name}" already exists — pick it from the list instead.` };
    }
    return { error: "Could not create description type. Please try again." };
  }
}

export type JobWorkProgress = { status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; isBilled: boolean };

/**
 * Change a job work's status and/or bill status from the LIST, without
 * opening it.
 *
 * The two rules live here, in one place, because the list is now a second
 * doorway to them and the form's disabled switch is only a hint:
 *
 * 1. Billed requires COMPLETED. The form expresses this by disabling the
 *    switch; a request that arrives anyway is refused, not coerced.
 * 2. Moving a status AWAY from Completed clears Billed. Otherwise the list
 *    could leave a row that is Pending and Billed at once — a state the form
 *    cannot produce and the dashboard's "to invoice" figure would misread.
 *    Silently un-billing would be worse than refusing, so it is reported.
 *
 * It writes through setJobWorkProgress, NOT updateJobWork: the latter deletes
 * and reinserts every description line, which would wipe the work breakdown of
 * any row whose status was flipped from the list.
 */
export async function setJobWorkProgressAction(
  jobWorkId: string,
  next: Partial<JobWorkProgress>
): Promise<{ ok: true; progress: JobWorkProgress } | { error: string }> {
  const userId = await getCurrentUserId();

  const current = await getJobWorkById(userId, jobWorkId);
  if (!current) return { error: "That job work no longer exists. Refresh the list." };

  const status = next.status ?? current.status;
  let isBilled = next.isBilled ?? current.isBilled;

  if (isBilled && status !== "COMPLETED") {
    // Asking to bill something unfinished is a refusal. Asking to un-complete
    // something already billed just un-bills it, and says so.
    if (next.isBilled === true) {
      return { error: "A job work can only be marked Billed once its status is Completed." };
    }
    isBilled = false;
  }

  const row = await setJobWorkProgress(userId, jobWorkId, { status, isBilled });
  if (!row) return { error: "Could not update that job work. Refresh the list." };

  revalidatePath("/job-work");
  revalidatePath(`/job-work/${jobWorkId}`);
  // The dashboard's month figures are status-derived, so they are stale now.
  revalidatePath("/dashboard");

  return { ok: true, progress: { status: row.status, isBilled: row.isBilled } };
}

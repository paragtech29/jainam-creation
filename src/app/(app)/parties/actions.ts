"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";
import {
  createParty,
  updateParty,
  archiveParty,
  unarchiveParty,
  deleteParty,
  findPartiesByName,
  getPartyById,
  addKarigarToParty,
} from "@/lib/db/repositories/parties";
import { partySchema, type PartyInput } from "@/lib/validation/party";
import { saveUploadedImage } from "@/lib/save-uploaded-image";

export type PartyFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<keyof PartyInput, string>>;
      success?: boolean;
      /** Echo of the submitted strings - see readValues(). */
      values?: Record<string, string>;
      /** Bumped per attempt so controlled dropdowns re-key. */
      submissionId?: number;
      newId?: string;
    }
  | undefined;

// React 19 resets a form after its action completes, so the form re-reads
// every defaultValue. Echoing the submitted strings back lets defaultValue
// land on what the person typed instead of on an empty create form.
const ECHO_FIELDS = ["name", "ownerName1", "ownerName2", "contact1", "contact2", "gender", "address", "email"] as const;

function readValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ECHO_FIELDS) {
    const v = formData.get(k);
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

// The unique index (drizzle/0002) is what actually guarantees uniqueness;
// the pre-check below is just there to give a nicer message first. Postgres
// raises 23505 if two submits race past the pre-check.
function isDuplicateName(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } })?.code
    ?? (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

function duplicateNameError(name: string, archivedOnly: boolean) {
  return archivedOnly
    ? `"${name}" already exists but is archived. Restore it from Show: Archived instead of adding it again.`
    : `"${name}" is already in your parties. Open that one to edit it.`;
}

export async function createPartyAction(
  _prevState: PartyFormState,
  formData: FormData
): Promise<PartyFormState> {
  // The user id comes from the session ONLY — never from a hidden form
  // field or URL parameter (see docs/DATA-ACCESS.md).
  const userId = await getCurrentUserId();

  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: flattened.name?.[0],
        ownerName1: flattened.ownerName1?.[0],
        ownerName2: flattened.ownerName2?.[0],
        contact1: flattened.contact1?.[0],
        contact2: flattened.contact2?.[0],
        gender: flattened.gender?.[0],
        address: flattened.address?.[0],
        email: flattened.email?.[0],
      },
    };
  }

  const data = parsed.data;

  // Refused, not warned. findPartiesByName matches case-insensitively, so
  // "mayra" collides with "Mayra".
  const existing = await findPartiesByName(userId, data.name);
  if (existing.length > 0) {
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: duplicateNameError(data.name, existing.every((p) => p.isArchived)),
      },
    };
  }

  // HTML forms submit empty optional inputs as "", not absent; storing ""
  // leaves visually-blank-but-present values in nullable columns.
  // Before the insert: a rejected image should not leave a party behind
  // that the owner then has to notice and fix.
  const logo = await saveUploadedImage(userId, formData, "logo", null);
  if (logo.error) {
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      error: logo.error,
    };
  }

  let party;
  try {
    party = await createParty(userId, {
      logoImageId: logo.imageId,
      name: data.name,
      ownerName1: data.ownerName1,
      ownerName2: data.ownerName2 || null,
      address: data.address || null,
      gender: data.gender,
      email: data.email || null,
      contact1: data.contact1 || null,
      contact2: data.contact2 || null,
    });
  } catch (err) {
    if (isDuplicateName(err)) {
      return {
        values: readValues(formData),
        submissionId: (_prevState?.submissionId ?? 0) + 1,
        fieldErrors: { name: duplicateNameError(data.name, false) },
      };
    }
    throw err;
  }

  revalidatePath("/parties");
  return { success: true, newId: party.id };
}

export async function updatePartyAction(
  partyId: string,
  _prevState: PartyFormState,
  formData: FormData
): Promise<PartyFormState> {
  const userId = await getCurrentUserId();

  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: flattened.name?.[0],
        ownerName1: flattened.ownerName1?.[0],
        ownerName2: flattened.ownerName2?.[0],
        contact1: flattened.contact1?.[0],
        contact2: flattened.contact2?.[0],
        gender: flattened.gender?.[0],
        address: flattened.address?.[0],
        email: flattened.email?.[0],
      },
    };
  }

  // confirmDuplicate is a create-only flag; strip it before persisting.
  const data = parsed.data;

  // A rename must not collide either, or the ban on duplicates would have a
  // hole in it: add "Mayra Creation", then rename it to "Mayra". Self is
  // excluded so re-saving a party without touching its name still works.
  const clashes = (await findPartiesByName(userId, data.name)).filter((p) => p.id !== partyId);
  if (clashes.length > 0) {
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: duplicateNameError(data.name, clashes.every((p) => p.isArchived)),
      },
    };
  }

  const existing = await getPartyById(userId, partyId);
  const updatedLogo = await saveUploadedImage(userId, formData, "logo", existing?.logoImageId);
  if (updatedLogo.error) {
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      error: updatedLogo.error,
    };
  }

  const party = await updateParty(userId, partyId, {
    logoImageId: updatedLogo.imageId,
    name: data.name,
    ownerName1: data.ownerName1,
    ownerName2: data.ownerName2 || null,
    address: data.address || null,
    gender: data.gender,
    email: data.email || null,
    contact1: data.contact1 || null,
    contact2: data.contact2 || null,
  });

  if (!party) return { error: "Party not found." };

  // Revalidating only the detail route leaves the list showing the stale
  // old name.
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
  return { success: true, newId: partyId };
}

export async function archivePartyAction(partyId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await archiveParty(userId, partyId);
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
  redirect("/parties");
}

export async function unarchivePartyAction(partyId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await unarchiveParty(userId, partyId);
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
}

export async function deletePartyAction(partyId: string): Promise<PartyFormState> {
  const userId = await getCurrentUserId();
  const result = await deleteParty(userId, partyId);
  if (!result.ok) {
    return { error: result.reason };
  }
  revalidatePath("/parties");
  redirect("/parties");
}

// Whole-set save behind the party detail checkbox list. An empty
// `karigarIds` array is a legitimate, meaningful submission — it means
// "unlink everyone" — so it is never short-circuited as a no-op.
// Phase 3 contract surface — treat this signature as published. This is
// deliberately ADDITIVE and single-purpose, kept separate from
// linkKarigarsAction (the whole-set replace) because Phase 3's job work
// form needs to link ONE karigar inline when the selected party has no
// karigars linked yet, without touching whatever else that party is
// already linked to and without leaving the half-filled job work form.
// Do not merge the two actions behind a mode flag — they are genuinely
// different operations.
export async function linkSingleKarigarAction(
  partyId: string,
  karigarId: string
): Promise<{ ok: true } | { error: string }> {
  const userId = await getCurrentUserId();

  try {
    // Ownership-checked and onConflictDoNothing-idempotent, so re-linking
    // an already-linked karigar is a silent no-op rather than a PK violation.
    await addKarigarToParty(userId, partyId, karigarId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not link karigar." };
  }

  revalidatePath(`/parties/${partyId}`);
  return { ok: true };
}

// Void-returning wrappers for the list-row action buttons. RowActions is a
// client component and needs `() => Promise<void>`; the originals return a
// form state that the detail screen relies on, so they are left alone.
export async function archivePartyRowAction(partyId: string): Promise<void> {
  await archivePartyAction(partyId);
}

export async function unarchivePartyRowAction(partyId: string): Promise<void> {
  await unarchivePartyAction(partyId);
}

export async function deletePartyRowAction(partyId: string): Promise<void> {
  await deletePartyAction(partyId);
}

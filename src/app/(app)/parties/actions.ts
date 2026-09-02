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
  addKarigarToParty,
} from "@/lib/db/repositories/parties";
import { partySchema, type PartyInput } from "@/lib/validation/party";

export type PartyFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<keyof PartyInput, string>>;
      duplicateWarning?: string;
      success?: boolean;
      newId?: string;
    }
  | undefined;

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
      error: "Please check the fields and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        ownerName1: flattened.ownerName1?.[0],
        email: flattened.email?.[0],
      },
    };
  }

  const { confirmDuplicate, ...data } = parsed.data;

  if (!confirmDuplicate) {
    const existing = await findPartiesByName(userId, data.name);
    if (existing.length > 0) {
      return {
        duplicateWarning: `A party named "${data.name}" already exists — add anyway?`,
      };
    }
  }

  // HTML forms submit empty optional inputs as "", not absent; storing ""
  // leaves visually-blank-but-present values in nullable columns.
  const party = await createParty(userId, {
    name: data.name,
    ownerName1: data.ownerName1,
    ownerName2: data.ownerName2 || null,
    address: data.address || null,
    gender: data.gender && data.gender !== "unspecified" ? data.gender : null,
    email: data.email || null,
    contact1: data.contact1 || null,
    contact2: data.contact2 || null,
  });

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
      error: "Please check the fields and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        ownerName1: flattened.ownerName1?.[0],
        email: flattened.email?.[0],
      },
    };
  }

  // confirmDuplicate is a create-only flag; strip it before persisting.
  const data = parsed.data;

  // No duplicate check on update — renaming a party to an existing name is
  // the owner correcting a spelling, not a mistaken second entry.
  const party = await updateParty(userId, partyId, {
    name: data.name,
    ownerName1: data.ownerName1,
    ownerName2: data.ownerName2 || null,
    address: data.address || null,
    gender: data.gender && data.gender !== "unspecified" ? data.gender : null,
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

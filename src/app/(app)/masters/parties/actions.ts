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
    gender: data.gender || null,
    email: data.email || null,
    contact1: data.contact1 || null,
    contact2: data.contact2 || null,
  });

  revalidatePath("/masters/parties");
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
    gender: data.gender || null,
    email: data.email || null,
    contact1: data.contact1 || null,
    contact2: data.contact2 || null,
  });

  if (!party) return { error: "Party not found." };

  // Revalidating only the detail route leaves the list showing the stale
  // old name.
  revalidatePath("/masters/parties");
  revalidatePath(`/masters/parties/${partyId}`);
  return { success: true, newId: partyId };
}

export async function archivePartyAction(partyId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await archiveParty(userId, partyId);
  revalidatePath("/masters/parties");
  revalidatePath(`/masters/parties/${partyId}`);
  redirect("/masters/parties");
}

export async function unarchivePartyAction(partyId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await unarchiveParty(userId, partyId);
  revalidatePath("/masters/parties");
  revalidatePath(`/masters/parties/${partyId}`);
}

export async function deletePartyAction(partyId: string): Promise<PartyFormState> {
  const userId = await getCurrentUserId();
  const result = await deleteParty(userId, partyId);
  if (!result.ok) {
    return { error: result.reason };
  }
  revalidatePath("/masters/parties");
  redirect("/masters/parties");
}

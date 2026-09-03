"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";
import {
  createKarigar,
  updateKarigar,
  archiveKarigar,
  unarchiveKarigar,
  deleteKarigar,
  findKarigarsByName,
} from "@/lib/db/repositories/karigars";
import { addKarigarToParty } from "@/lib/db/repositories/parties";
import { replaceKarigarPartyLinks } from "@/lib/db/repositories/karigars";
import { karigarSchema } from "@/lib/validation/karigar";

export type KarigarFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<"name" | "address" | "contact1" | "contact2", string>>;
      duplicateWarning?: string;
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
const ECHO_FIELDS = ["name", "contact1", "contact2", "address"] as const;

function readValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ECHO_FIELDS) {
    const v = formData.get(k);
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function createKarigarAction(
  _prevState: KarigarFormState,
  formData: FormData
): Promise<KarigarFormState> {
  const userId = await getCurrentUserId();

  const parsed = karigarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: flattened.name?.[0],
        address: flattened.address?.[0],
        contact1: flattened.contact1?.[0],
        contact2: flattened.contact2?.[0],
      },
    };
  }
  const { name, address, contact1, contact2, confirmDuplicate } = parsed.data;

  // Repeated checkbox values must be read via getAll — Object.fromEntries
  // above collapses repeats to a single value. See comment in karigarSchema.
  const partyIds = formData.getAll("partyIds").map(String).filter(Boolean);

  if (!confirmDuplicate) {
    const existing = await findKarigarsByName(userId, name);
    if (existing.length > 0) {
      return {
        values: readValues(formData),
        submissionId: (_prevState?.submissionId ?? 0) + 1,
        duplicateWarning: `A karigar named "${name}" already exists — add anyway?`,
      };
    }
  }

  const karigar = await createKarigar(userId, {
    name,
    address: address || null,
    contact1: contact1 || null,
    contact2: contact2 || null,
  });

  for (const partyId of partyIds) {
    await addKarigarToParty(userId, partyId, karigar.id);
  }

  revalidatePath("/karigars");
  if (partyIds.length > 0) {
    revalidatePath("/parties");
  }

  return { success: true, newId: karigar.id };
}

export async function updateKarigarAction(
  karigarId: string,
  _prevState: KarigarFormState,
  formData: FormData
): Promise<KarigarFormState> {
  const userId = await getCurrentUserId();

  const parsed = karigarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      values: readValues(formData),
      submissionId: (_prevState?.submissionId ?? 0) + 1,
      fieldErrors: {
        name: flattened.name?.[0],
        address: flattened.address?.[0],
        contact1: flattened.contact1?.[0],
        contact2: flattened.contact2?.[0],
      },
    };
  }
  const { name, address, contact1, contact2 } = parsed.data;

  const updated = await updateKarigar(userId, karigarId, {
    name,
    address: address || null,
    contact1: contact1 || null,
    contact2: contact2 || null,
  });
  if (!updated) return { error: "Karigar not found." };

  // Linking is managed here, on the karigar, so an edit replaces the whole
  // party set atomically. Unticking a party only stops offering this karigar
  // for that party's NEW job works — existing job works are untouched.
  const partyIds = formData.getAll("partyIds").map(String).filter(Boolean);
  await replaceKarigarPartyLinks(userId, karigarId, partyIds);

  revalidatePath("/parties");
  revalidatePath("/karigars");
  revalidatePath(`/karigars/${karigarId}`);

  return { success: true, newId: karigarId };
}

export async function archiveKarigarAction(karigarId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await archiveKarigar(userId, karigarId);
  revalidatePath("/karigars");
  revalidatePath(`/karigars/${karigarId}`);
  redirect("/karigars");
}

export async function unarchiveKarigarAction(karigarId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await unarchiveKarigar(userId, karigarId);
  revalidatePath("/karigars");
  revalidatePath(`/karigars/${karigarId}`);
}

export async function deleteKarigarAction(
  karigarId: string
): Promise<{ error: string } | void> {
  const userId = await getCurrentUserId();
  const result = await deleteKarigar(userId, karigarId);
  if (!result.ok) {
    return { error: result.reason };
  }
  revalidatePath("/karigars");
  redirect("/karigars");
}

// Void-returning wrappers for the list-row action buttons — see the matching
// note in parties/actions.ts.
export async function archiveKarigarRowAction(karigarId: string): Promise<void> {
  await archiveKarigarAction(karigarId);
}

export async function unarchiveKarigarRowAction(karigarId: string): Promise<void> {
  await unarchiveKarigarAction(karigarId);
}

export async function deleteKarigarRowAction(karigarId: string): Promise<void> {
  await deleteKarigarAction(karigarId);
}

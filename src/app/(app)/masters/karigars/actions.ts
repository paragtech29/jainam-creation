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
import { karigarSchema } from "@/lib/validation/karigar";

export type KarigarFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<"name" | "address" | "contact1" | "contact2", string>>;
      duplicateWarning?: string;
      success?: boolean;
      newId?: string;
    }
  | undefined;

export async function createKarigarAction(
  _prevState: KarigarFormState,
  formData: FormData
): Promise<KarigarFormState> {
  const userId = await getCurrentUserId();

  const parsed = karigarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Please check the fields and try again.",
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

  revalidatePath("/masters/karigars");
  if (partyIds.length > 0) {
    revalidatePath("/masters/parties");
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
      error: "Please check the fields and try again.",
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

  revalidatePath("/masters/karigars");
  revalidatePath(`/masters/karigars/${karigarId}`);

  return { success: true, newId: karigarId };
}

export async function archiveKarigarAction(karigarId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await archiveKarigar(userId, karigarId);
  revalidatePath("/masters/karigars");
  revalidatePath(`/masters/karigars/${karigarId}`);
  redirect("/masters/karigars");
}

export async function unarchiveKarigarAction(karigarId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await unarchiveKarigar(userId, karigarId);
  revalidatePath("/masters/karigars");
  revalidatePath(`/masters/karigars/${karigarId}`);
}

export async function deleteKarigarAction(
  karigarId: string
): Promise<{ error: string } | void> {
  const userId = await getCurrentUserId();
  const result = await deleteKarigar(userId, karigarId);
  if (!result.ok) {
    return { error: result.reason };
  }
  revalidatePath("/masters/karigars");
  redirect("/masters/karigars");
}

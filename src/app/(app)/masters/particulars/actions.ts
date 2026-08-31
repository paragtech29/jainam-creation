"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import {
  listParticulars,
  createParticular,
  updateParticular,
  archiveParticular,
  unarchiveParticular,
  deleteParticular,
} from "@/lib/db/repositories/particulars";
import { particularSchema } from "@/lib/validation/particular";

export type ParticularFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<"name" | "defaultPrice", string>>;
      success?: boolean;
      newId?: string;
    }
  | undefined;

// NOTE: there is deliberately NO `duplicateWarning` field on this state.
// Unlike parties/karigars (warn-and-allow), particulars BLOCK duplicate
// names outright (locked user decision, backed by the DB-level
// `particulars_user_name_unique` index). Adding an unused warning field
// here would invite a future author to wire up the wrong (warn) flow.

// Returns true when `err` (or its `cause`) is a Postgres unique-violation
// (code 23505) against the particulars name unique index. Used by both
// create paths so a raced double-submit that slips past the pre-check
// still surfaces the same friendly message instead of a raw DB error.
function isUniqueNameViolation(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown } | null)?.cause];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "code" in candidate &&
      (candidate as { code?: unknown }).code === "23505"
    ) {
      const message = String(
        (candidate as { message?: unknown; constraint?: unknown }).message ??
          (candidate as { constraint?: unknown }).constraint ??
          ""
      );
      if (message.includes("particulars_user_name_unique")) return true;
      // Some drivers surface the constraint name separately.
      if (
        "constraint" in candidate &&
        String((candidate as { constraint?: unknown }).constraint) ===
          "particulars_user_name_unique"
      ) {
        return true;
      }
    }
  }
  return false;
}

function duplicateNameMessage(name: string) {
  return `A particular named "${name}" already exists — edit it instead.`;
}

export async function createParticularAction(
  _prevState: ParticularFormState,
  formData: FormData
): Promise<ParticularFormState> {
  const userId = await getCurrentUserId();

  const parsed = particularSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Please check the fields and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        defaultPrice: flattened.defaultPrice?.[0],
      },
    };
  }
  const { name, defaultPrice } = parsed.data;

  // Pre-check: give the clean, actionable message in the normal case.
  const existing = await listParticulars(userId);
  const collision = existing.find(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (collision) {
    return { fieldErrors: { name: duplicateNameMessage(name) } };
  }

  try {
    const particular = await createParticular(userId, { name, defaultPrice });
    revalidatePath("/masters/particulars");
    return { success: true, newId: particular.id };
  } catch (err) {
    // Belt-and-braces: covers a raced double-submit that slips past the
    // pre-check above. Under no circumstances may a raw Postgres error
    // reach the UI.
    if (isUniqueNameViolation(err)) {
      return { fieldErrors: { name: duplicateNameMessage(name) } };
    }
    throw err;
  }
}

export async function updateParticularAction(
  particularId: string,
  _prevState: ParticularFormState,
  formData: FormData
): Promise<ParticularFormState> {
  const userId = await getCurrentUserId();

  const parsed = particularSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Please check the fields and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        defaultPrice: flattened.defaultPrice?.[0],
      },
    };
  }
  const { name, defaultPrice } = parsed.data;

  // Exclude the record's own id so saving an unchanged name is never
  // reported as a duplicate of itself.
  const existing = await listParticulars(userId);
  const collision = existing.find(
    (p) =>
      p.id !== particularId &&
      p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (collision) {
    return { fieldErrors: { name: duplicateNameMessage(name) } };
  }

  // Editing defaultPrice intentionally affects only FUTURE job works.
  // Particular prices are snapshotted onto each job work at save time
  // (a locked project decision, implemented in Phase 3), so this action
  // must never attempt to rewrite historical job work rows. It also
  // never sets `updatedAt` — the particulars table has no such column
  // (only createdAt).
  try {
    const updated = await updateParticular(userId, particularId, {
      name,
      defaultPrice,
    });
    if (!updated) return { error: "Particular not found." };

    revalidatePath("/masters/particulars");
    revalidatePath(`/masters/particulars/${particularId}`);
    return { success: true, newId: particularId };
  } catch (err) {
    if (isUniqueNameViolation(err)) {
      return { fieldErrors: { name: duplicateNameMessage(name) } };
    }
    throw err;
  }
}

export async function archiveParticularAction(particularId: string) {
  const userId = await getCurrentUserId();
  await archiveParticular(userId, particularId);
  revalidatePath("/masters/particulars");
  revalidatePath(`/masters/particulars/${particularId}`);
  redirect("/masters/particulars");
}

export async function unarchiveParticularAction(particularId: string) {
  const userId = await getCurrentUserId();
  await unarchiveParticular(userId, particularId);
  revalidatePath("/masters/particulars");
  revalidatePath(`/masters/particulars/${particularId}`);
}

export async function deleteParticularAction(particularId: string) {
  const userId = await getCurrentUserId();
  const result = await deleteParticular(userId, particularId);
  if (!result.ok) {
    return { error: result.reason };
  }
  revalidatePath("/masters/particulars");
  redirect("/masters/particulars");
}

// The PART-03 action Phase 3 consumes: treat this signature as a
// published contract. It MUST take (_prevState, formData) — a FormData
// second argument, not a plain object — so it wires directly to
// useActionState from a bottom-sheet form exactly like every other
// action in this codebase, and Phase 3 needs to build only the overlay
// UI. It MUST NOT redirect and MUST NOT return `{ success: true }`
// alone: the caller needs the created record back so it can select it
// immediately without a page reload.
export type CreateParticularInlineState =
  | {
      error?: string;
      fieldErrors?: { name?: string; defaultPrice?: string };
      particular?: { id: string; name: string; defaultPrice: number };
    }
  | undefined;

export async function createParticularInlineAction(
  _prevState: CreateParticularInlineState,
  formData: FormData
): Promise<CreateParticularInlineState> {
  const userId = await getCurrentUserId();

  const parsed = particularSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Please check the fields and try again.",
      fieldErrors: {
        name: flattened.name?.[0],
        defaultPrice: flattened.defaultPrice?.[0],
      },
    };
  }
  const { name, defaultPrice } = parsed.data;

  const existing = await listParticulars(userId);
  const collision = existing.find(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (collision) {
    return { fieldErrors: { name: duplicateNameMessage(name) } };
  }

  try {
    const particular = await createParticular(userId, { name, defaultPrice });
    revalidatePath("/masters/particulars");
    return {
      particular: {
        id: particular.id,
        name: particular.name,
        defaultPrice: particular.defaultPrice,
      },
    };
  } catch (err) {
    if (isUniqueNameViolation(err)) {
      return { fieldErrors: { name: duplicateNameMessage(name) } };
    }
    throw err;
  }
}

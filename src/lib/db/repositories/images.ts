// Uploaded image bytes. Same userId-scoping contract as every other
// repository: userId is the mandatory first argument, and a wrong one matches
// zero rows rather than throwing or reaching another user's data.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { images } from "@/lib/db/schema";

export type { Image } from "@/lib/db/schema";

/** What the app is willing to store. Anything else is refused at the door. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Hard ceiling on a stored image, after the browser has compressed it.
 *
 * The browser aims for far less than this (~100-300KB). This is the backstop
 * for a request that skipped the browser entirely — a Server Action is a
 * public endpoint, so "the client already compressed it" is not a guarantee.
 * At 2MB, filling Neon's 0.5GB free tier would still take ~250 images.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export async function createImage(
  userId: string,
  data: { mimeType: string; bytes: Buffer }
): Promise<{ id: string }> {
  const [row] = await db
    .insert(images)
    .values({
      userId,
      mimeType: data.mimeType,
      byteSize: data.bytes.byteLength,
      bytes: data.bytes,
    })
    .returning({ id: images.id });
  return row;
}

/** The bytes themselves — only ever called by the route that serves one image. */
export async function getImageBytes(
  userId: string,
  id: string
): Promise<{ mimeType: string; bytes: Buffer } | null> {
  const [row] = await db
    .select({ mimeType: images.mimeType, bytes: images.bytes })
    .from(images)
    .where(and(eq(images.userId, userId), eq(images.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * Remove an image. Callers pass the id they are REPLACING or clearing, so a
 * null id is a normal no-op rather than a caller-side branch everywhere.
 */
export async function deleteImage(userId: string, id: string | null | undefined): Promise<void> {
  if (!id) return;
  await db.delete(images).where(and(eq(images.userId, userId), eq(images.id, id)));
}

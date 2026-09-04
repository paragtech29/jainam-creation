import {
  createImage,
  deleteImage,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/db/repositories/images";

/**
 * Turn one uploaded field into a stored image id, for a form that has an
 * ImageUpload on it.
 *
 * The three cases a form can post, and why "no file" is not enough on its
 * own to mean anything:
 *
 *   - a file          -> store it, and delete whatever it replaced
 *   - `<name>Remove`  -> delete the current one, keep nothing
 *   - neither         -> leave the existing image exactly as it is
 *
 * Returns what the record's image column should now be, or an error message
 * fit to show the owner. Validation is repeated here even though the browser
 * compresses and filters first: a Server Action is a public endpoint, so
 * "the client already checked" is not a guarantee.
 */
export async function saveUploadedImage(
  userId: string,
  formData: FormData,
  field: string,
  currentImageId: string | null | undefined
): Promise<{ imageId: string | null; error?: undefined } | { error: string; imageId?: undefined }> {
  const removed = formData.get(`${field}Remove`) === "1";
  const raw = formData.get(field);
  const file = raw instanceof File && raw.size > 0 ? raw : null;

  if (!file) {
    if (removed) {
      await deleteImage(userId, currentImageId);
      return { imageId: null };
    }
    return { imageId: currentImageId ?? null };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { error: "Only JPG, PNG or WEBP images can be uploaded." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { error: `That image is ${mb}MB, which is too large. Try a smaller one.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const created = await createImage(userId, { mimeType: file.type, bytes });

  // Only after the replacement is safely stored. Deleting first would lose
  // the old picture if the insert then failed.
  await deleteImage(userId, currentImageId);

  return { imageId: created.id };
}

"use client";

/**
 * Shrink a picked image in the browser before it is uploaded.
 *
 * This is what makes storing bytes in Postgres reasonable at all: a phone
 * camera photo is commonly 3-6MB, and Neon's free tier is 0.5GB. At ~150KB a
 * photo that is a few thousand images instead of a hundred.
 *
 * It is also the difference between an upload that finishes on mobile data
 * and one that appears to hang.
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

/** Encoders tried in order. webp first — noticeably smaller, and keeps alpha. */
const ENCODERS = ["image/webp", "image/jpeg"] as const;

export type CompressResult = {
  file: File;
  /** For the preview. The caller must revokeObjectURL when done with it. */
  previewUrl: string;
  originalBytes: number;
  compressedBytes: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<CompressResult> {
  // imageOrientation: "from-image" applies the EXIF rotation. Without it, a
  // photo taken in portrait on a phone arrives sideways — the camera records
  // the rotation as metadata rather than rotating the pixels.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  let type = "";
  for (const candidate of ENCODERS) {
    blob = await canvasToBlob(canvas, candidate, QUALITY);
    // A browser that cannot encode the requested type silently returns PNG,
    // so check what actually came back rather than what was asked for.
    if (blob && blob.type === candidate) {
      type = candidate;
      break;
    }
  }
  if (!blob) throw new Error("Could not process that image.");
  if (!type) type = blob.type || "image/png";

  // Re-encoding a small, already-optimised image can make it BIGGER. If that
  // happened and the original is a type we accept, keep the original.
  const keepOriginal =
    blob.size >= file.size && ["image/jpeg", "image/png", "image/webp"].includes(file.type);

  const finalBlob = keepOriginal ? file : blob;
  const finalType = keepOriginal ? file.type : type;
  const ext = finalType.split("/")[1] ?? "jpg";

  const out = new File([finalBlob], `upload.${ext}`, { type: finalType });

  return {
    file: out,
    previewUrl: URL.createObjectURL(out),
    originalBytes: file.size,
    compressedBytes: out.size,
  };
}

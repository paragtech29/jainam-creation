import { getCurrentUserId } from "@/lib/session";
import { getImageBytes } from "@/lib/db/repositories/images";

/**
 * Serves one stored image.
 *
 * Session-checked and userId-scoped: an image id belonging to someone else is
 * a 404, not a 403, so this cannot be used to probe which ids exist. Same
 * reasoning as the rest of the app's data access — the id is not the
 * permission.
 *
 * `params` is a Promise in Next 16 and must be awaited.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const image = await getImageBytes(userId, id);
  if (!image) return new Response("Not found", { status: 404 });

  // Ids are cuids and an image's bytes never change once stored — a replaced
  // photo gets a NEW row and a new id — so this is genuinely immutable and
  // can be cached hard. `private` because it is one user's data.
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      // Belt and braces: never let a stored file be interpreted as markup.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

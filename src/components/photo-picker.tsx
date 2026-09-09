"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";

/**
 * Up to two photos, behind one small "+ Add photo" control.
 *
 * Replaces two full-width dashed drop zones that occupied a third of the form
 * before a single photo had been chosen — the owner asked for this shape, and
 * it is the honest one: photos are optional here and most job works will have
 * none, so the empty state should cost one line, not two boxes.
 *
 * The FORM CONTRACT is unchanged, deliberately. The server still receives
 * `photo1` / `photo2` file fields and `photo1Remove` / `photo2Remove` flags —
 * `saveUploadedImage()` resolves those three cases and nothing about it needed
 * to move. So this is a presentation change over a proven backend, not a new
 * upload path.
 *
 * Upload only: no `capture` attribute anywhere, as the owner was explicit that
 * tapping should open the picker rather than the camera.
 */
type Slot = {
  /** Already saved, served by /api/images/<id>. */
  currentImageId: string | null;
  /** Object URL for a freshly picked file. */
  previewUrl: string | null;
  /** True once a SAVED image is cleared — posts `<name>Remove=1`. */
  removed: boolean;
};

export function PhotoPicker({
  names,
  currentImageIds,
  label = "Photos",
  max = 2,
}: {
  /** One form field name per slot, e.g. ["photo1", "photo2"]. */
  names: readonly [string, string];
  currentImageIds: readonly [string | null, string | null];
  label?: string;
  max?: number;
}) {
  const hiddenInputs = useRef<(HTMLInputElement | null)[]>([]);
  const picker = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<Slot[]>(() =>
    names.map((_, i) => ({
      currentImageId: currentImageIds[i] ?? null,
      previewUrl: null,
      removed: false,
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A blob URL is a live reference; not revoking it leaks the image for as
  // long as the page is open.
  useEffect(() => {
    const urls = slots.map((s) => s.previewUrl).filter(Boolean) as string[];
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = (s: Slot) => Boolean(s.previewUrl || (s.currentImageId && !s.removed));
  const count = slots.filter(filled).length;

  function openPicker() {
    if (count >= max) return;
    setError(null);
    picker.current?.click();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("That is not an image file.");
      e.target.value = "";
      return;
    }

    // The slot is decided HERE, from the current state, rather than being
    // remembered from whichever control opened the dialog. Tracking it in a
    // ref meant a file arriving by any other route - keyboard, drag, a test -
    // silently overwrote slot one; state is the only thing that actually
    // knows which slot is free.
    const i = slots.findIndex((sl) => !filled(sl));
    if (i === -1) {
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const result = await compressImage(file);

      // The COMPRESSED file is what posts, via a hidden named input — the
      // visible picker is nameless and never submitted.
      const dt = new DataTransfer();
      dt.items.add(result.file);
      const input = hiddenInputs.current[i];
      if (input) input.files = dt.files;

      setSlots((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, previewUrl: result.previewUrl, removed: false } : s
        )
      );
    } catch {
      setError("Could not read that image. Try a different one.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a removal.
      e.target.value = "";
    }
  }

  function remove(i: number) {
    const input = hiddenInputs.current[i];
    if (input) input.value = "";
    setSlots((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        return {
          ...s,
          previewUrl: null,
          // Only meaningful when there WAS a saved image; harmless otherwise.
          removed: Boolean(s.currentImageId),
        };
      })
    );
    setError(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-snug">{label}</span>

      {names.map((name, i) => (
        <div key={name}>
          <input
            ref={(el) => {
              hiddenInputs.current[i] = el;
            }}
            type="file"
            name={name}
            accept="image/*"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          {slots[i].removed ? <input type="hidden" name={`${name}Remove`} value="1" /> : null}
        </div>
      ))}

      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2.5">
        {slots.map((s, i) => {
          if (!filled(s)) return null;
          const src = s.previewUrl ?? `/api/images/${s.currentImageId}`;
          return (
            <span
              key={names[i]}
              className="group relative size-[54px] overflow-hidden rounded-[10px] border border-input bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob:
                  URL or a session-guarded route; next/image would need neither
                  its optimiser nor a configured remote pattern here. */}
              <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-white transition-colors hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          );
        })}

        {count < max ? (
          <button
            type="button"
            onClick={openPicker}
            disabled={busy}
            className={cn(
              "inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-dashed border-input bg-card px-4 text-[13.5px] font-medium",
              "transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            )}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Preparing…
              </>
            ) : (
              <>
                <ImagePlus size={15} aria-hidden="true" />
                Add photo
              </>
            )}
          </button>
        ) : null}

        {error ? (
          <p role="alert" data-slot="field-error" className="text-xs text-destructive">
            {error}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">
            {count >= max
              ? `${max} of ${max} added`
              : `Optional · up to ${max} · JPG, PNG or WEBP`}
          </span>
        )}
      </div>
    </div>
  );
}

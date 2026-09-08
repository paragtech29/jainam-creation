"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";
import { EntityAvatar } from "@/components/entity-avatar";

/**
 * Pick an image from the device and post it with the surrounding form.
 *
 * Upload only — the owner was explicit: "user just upload photo not click
 * from camera, just open box select image". So there is deliberately NO
 * `capture` attribute; adding one makes a phone open the camera directly
 * instead of the picker, which is precisely what he did not want.
 *
 * How it posts: the picked file is compressed in the browser, and the RESULT
 * is placed into a second, hidden file input via DataTransfer. That hidden
 * input is the one with a `name`, so the form sends the small version rather
 * than the multi-megabyte original. The visible input is nameless and never
 * submitted.
 *
 * Removing an existing image posts `<name>Remove=1`, because "no file in the
 * field" cannot distinguish "clear it" from "leave it alone".
 */
export function ImageUpload({
  name,
  label,
  hint,
  currentImageId,
  className,
  onChanged,
  variant = "box",
  entityName,
}: {
  /** Form field name. The removal flag is posted as `${name}Remove`. */
  name: string;
  label: string;
  hint?: string;
  /** Already-saved image, served by /api/images/<id>. */
  currentImageId?: string | null;
  className?: string;
  /** So a form can enable its Save button when a picture changes. */
  onChanged?: () => void;
  /**
   * "box" — a wide drop area, for a photo of the work.
   * "avatar" — a round thumbnail with the controls beside it, for a logo.
   *   A logo is small; giving it a full-width box left a tiny image floating
   *   in a large empty rectangle.
   */
  variant?: "box" | "avatar";
  /** Avatar variant: whose initials to show before anything is uploaded. */
  entityName?: string;
}) {
  const visibleInput = useRef<HTMLInputElement>(null);
  const hiddenInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(
    currentImageId ? `/api/images/${currentImageId}` : null
  );
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // A blob URL is a live reference; not revoking it leaks the image for as
  // long as the page is open.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("That is not an image file.");
      e.target.value = "";
      return;
    }

    setBusy(true);
    try {
      const result = await compressImage(file);

      const dt = new DataTransfer();
      dt.items.add(result.file);
      if (hiddenInput.current) hiddenInput.current.files = dt.files;

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(result.previewUrl);
      setPreview(result.previewUrl);
      setRemoved(false);
      onChanged?.();
    } catch {
      setError("Could not read that image. Try a different one.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a removal.
      e.target.value = "";
    }
  }

  function onRemove() {
    if (hiddenInput.current) hiddenInput.current.value = "";
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setPreview(null);
    setError(null);
    // Only meaningful when there WAS a saved image; harmless otherwise.
    setRemoved(Boolean(currentImageId));
    onChanged?.();
  }

  // Shared by both variants: the hidden named input that actually posts the
  // compressed file, the removal flag, and the nameless picker.
  const plumbing = (
    <>
      <input
        ref={hiddenInput}
        type="file"
        name={name}
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      {removed ? <input type="hidden" name={`${name}Remove`} value="1" /> : null}
      <input
        ref={visibleInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
    </>
  );

  if (variant === "avatar") {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <span className="text-sm font-medium leading-snug">{label}</span>
        {plumbing}

        <div className="flex items-center gap-3">
          {/* The same round avatar the list shows, so what you pick here is
              visibly the thing that will appear beside the name. */}
          <EntityAvatar name={entityName || label} src={preview} size="lg" />

          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => visibleInput.current?.click()}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-input bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Preparing…
                </>
              ) : (
                <>
                  <ImagePlus size={14} aria-hidden="true" />
                  {preview ? "Change" : "Choose image"}
                </>
              )}
            </button>

            {preview ? (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:underline"
              >
                <X size={12} aria-hidden="true" />
                Remove
              </button>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">JPG, PNG or WEBP</span>
            )}
          </div>
        </div>

        {error ? (
          <p role="alert" data-slot="field-error" className="text-xs text-destructive">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium leading-snug">{label}</span>

      <input
        ref={hiddenInput}
        type="file"
        name={name}
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      {removed ? <input type="hidden" name={`${name}Remove`} value="1" /> : null}

      {preview ? (
        <div className="relative w-full overflow-hidden rounded-[10px] border border-input bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL
              and a session-guarded route; next/image would need neither its
              optimiser nor a configured remote pattern here. */}
          <img src={preview} alt={label} className="h-[132px] w-full object-contain" />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-foreground/70 text-white transition-colors hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => visibleInput.current?.click()}
          disabled={busy}
          className="flex h-[132px] w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-input bg-card text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span className="text-[13px]">Preparing…</span>
            </>
          ) : (
            <>
              <ImagePlus size={20} aria-hidden="true" />
              <span className="text-[13px] font-medium">Choose an image</span>
              <span className="text-[11.5px]">JPG, PNG or WEBP</span>
            </>
          )}
        </button>
      )}

      <input
        ref={visibleInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />

      {error ? (
        <p role="alert" data-slot="field-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

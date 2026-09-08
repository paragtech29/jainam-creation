import { cn } from "@/lib/utils";

/**
 * A round logo, with initials as the fallback.
 *
 * Shared by the parties list and the logo picker on the party form on
 * purpose: the thumbnail you upload should be visibly the same object as the
 * one that then appears beside the name in the list. Two separate
 * implementations would drift in size, radius or crop and quietly stop
 * matching.
 *
 * The initials fallback is not decoration — a party with no logo still needs
 * something in that column, or the first column looks broken for some rows
 * and fine for others.
 *
 * The image is CONTAINED, never cropped. `object-cover` fills the circle by
 * cutting off whatever does not fit, which ate the top and bottom of a tall
 * portrait logo — and a brand mark that has lost part of itself is no longer
 * the mark. Cropping is right for a photograph (the job work photos still use
 * it); it is wrong for a logo. The cost is that a very wide or very tall logo
 * renders smaller inside the circle, which is the correct trade: whole and
 * small beats large and beheaded.
 */
const SIZES = {
  sm: { box: "size-7", text: "text-[10px]", pad: "p-[3px]" },
  md: { box: "size-9", text: "text-[11.5px]", pad: "p-[3px]" },
  lg: { box: "size-16", text: "text-lg", pad: "p-1.5" },
} as const;

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  // Two words give two initials; one word gives its first two letters, which
  // reads better than a single lonely character.
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function EntityAvatar({
  name,
  imageId,
  /** A blob: URL, for previewing a file that is not uploaded yet. */
  src,
  size = "sm",
  className,
}: {
  name: string;
  imageId?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const url = src ?? (imageId ? `/api/images/${imageId}` : null);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        // The ring keeps a white or pale logo from dissolving into the row.
        // The padding stops a contained logo's own edge from sitting flush
        // against that ring, which reads as a rendering fault.
        url ? cn("bg-card ring-1 ring-border", s.pad) : "bg-accent",
        s.box,
        className
      )}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element -- a blob: URL or
           a session-guarded route; next/image would need neither its optimiser
           nor a configured remote pattern here. */
        <img src={url} alt="" className="size-full object-contain" />
      ) : (
        <span className={cn("font-semibold text-brand-dark", s.text)} aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

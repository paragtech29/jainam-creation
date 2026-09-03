import type { LucideIcon } from "lucide-react";

/**
 * The illustration for an empty page.
 *
 * Hand-authored inline SVG — no stock art, no image files, no licence to
 * worry about, nothing extra to download. Same reasoning as the login
 * panel's gradient mesh.
 *
 * The subject is the thing the app replaces: a ruled register page, with a
 * dashed line running across it that reads as a stitch. Colours come from
 * the theme variables, so this cannot drift from the palette.
 *
 * Two variants:
 *  - "page"   — nothing here yet (first run)
 *  - "search" — a magnifier over the page: we looked, there was nothing
 */
export function EmptyIllustration({
  icon: Icon,
  variant = "page",
}: {
  icon: LucideIcon;
  variant?: "page" | "search";
}) {
  return (
    <div className="empty-illustration relative">
      <svg
        width="196"
        height="150"
        viewBox="0 0 196 150"
        fill="none"
        role="presentation"
        aria-hidden="true"
      >
        {/* Soft ground, so the page does not float on plain white. */}
        <ellipse cx="98" cy="136" rx="66" ry="8" fill="var(--accent)" opacity="0.7" />

        {/* Two leaves behind, to suggest a book rather than one sheet. */}
        <rect x="46" y="20" width="104" height="106" rx="11" fill="var(--accent)" opacity="0.45" transform="rotate(-6 98 73)" />
        <rect x="42" y="16" width="108" height="110" rx="11" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />

        {/* A heading bar and ruled lines: the register page. */}
        <rect x="58" y="32" width="46" height="7" rx="3.5" fill="var(--brand-light)" />
        <rect x="58" y="52" width="76" height="5" rx="2.5" fill="var(--border)" />
        <rect x="58" y="66" width="60" height="5" rx="2.5" fill="var(--border)" />
        <rect x="58" y="80" width="70" height="5" rx="2.5" fill="var(--border)" />
        <rect x="58" y="94" width="40" height="5" rx="2.5" fill="var(--border)" />

        {/* The stitch. Dashed on purpose — it is the one embroidery cue. */}
        <path
          className="empty-stitch"
          d="M50 112 H142"
          stroke="var(--brand-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="7 7"
        />

        {variant === "search" ? (
          <g>
            {/* Magnifier, sitting over the page's lower-right corner. */}
            <circle cx="132" cy="86" r="27" fill="var(--card)" fillOpacity="0.92" stroke="var(--brand)" strokeWidth="3" />
            <path d="M151 105 L166 120" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" />
            {/* A short glint, so the lens reads as glass. */}
            <path d="M122 76 A13 13 0 0 1 134 71" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
          </g>
        ) : null}
      </svg>

      {/* The context icon rides in a badge — Building2 for parties, Scissors
          for karigars — so the same illustration reads as the right page.
          On the search variant the magnifier already carries the meaning. */}
      {variant === "page" ? (
        <span className="absolute -right-1 bottom-6 flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-card-hover">
          <Icon size={22} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

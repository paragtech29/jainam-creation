import Link from "next/link";
import { cn } from "@/lib/utils";

// Shared "Show archived" control for all three register lists (parties,
// karigars, particulars — plans 02-03/02-04/02-05). State lives in the URL
// as a search param, not in React state, so a refresh preserves the view.
// This also establishes the URL-state pattern Phase 5's job-work filters
// will reuse. The caller computes `href` (on/off) and owns the routing.
export function SwitchLink({
  href,
  checked,
  label,
}: {
  href: string;
  checked: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="switch"
      aria-checked={checked}
      className="flex min-h-11 items-center gap-2 py-1"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-background transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </Link>
  );
}

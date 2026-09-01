import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Page state lives in the URL alongside search and the archived toggle, so
// every view is shareable and survives a refresh.
export function Pagination({
  page,
  pageSize,
  total,
  baseParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  baseParams: Record<string, string | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `?${s}` : "?";
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular-nums">{from}</span>–
        <span className="font-medium text-foreground tabular-nums">{to}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span>
      </p>

      {lastPage > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={href(page - 1)}
            aria-label="Previous page"
            aria-disabled={page <= 1}
            className={cn(btn, page <= 1 && disabled)}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </Link>
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            Page {page} of {lastPage}
          </span>
          <Link
            href={href(page + 1)}
            aria-label="Next page"
            aria-disabled={page >= lastPage}
            className={cn(btn, page >= lastPage && disabled)}
          >
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

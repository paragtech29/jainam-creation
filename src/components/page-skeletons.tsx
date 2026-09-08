import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a page shows while its data is on the way.
 *
 * These exist because there were no `loading.tsx` files at all: Next then
 * holds the OLD screen until the server has finished, so on a phone a tap on
 * "Parties" did nothing visible for several seconds and the owner reasonably
 * concluded the navigation was broken and tapped again. A skeleton makes the
 * route commit immediately — the header title changes, the sidebar pill moves,
 * and the body shows the shape of what is coming.
 *
 * They deliberately mirror the real layout (same row heights, same columns,
 * same pinned pager) so the page does not jump when the data lands. A generic
 * centred spinner would be less work and worse: it tells you to wait without
 * telling you what for.
 */

function Row({ cols }: { cols: string[] }) {
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
      {cols.map((w, i) => (
        <Skeleton key={i} className={`h-4 ${w}`} />
      ))}
    </div>
  );
}

/** Parties and Silai Karigar: search + filter, a table, a pinned pager. */
export function ListPageSkeleton({
  rows = 6,
  cols = ["w-[38%]", "w-[24%]", "w-[20%]", "ml-auto w-[64px]"],
}: {
  rows?: number;
  cols?: string[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-[320px] rounded-[10px]" />
        <Skeleton className="h-10 w-[188px] rounded-[10px]" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
          {cols.map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <Row key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}

/** Job work: the filter card sits above the table. */
export function JobWorkPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-border bg-card p-[14px_16px]">
        <Skeleton className="h-10 w-[320px] rounded-[10px]" />
        <Skeleton className="h-10 w-[263px] rounded-[10px]" />
        <Skeleton className="h-10 w-[184px] rounded-[10px]" />
        <Skeleton className="h-10 w-[184px] rounded-[10px]" />
        <Skeleton className="h-10 w-[184px] rounded-[10px]" />
        <Skeleton className="h-10 w-[184px] rounded-[10px]" />
      </div>

      <ListPageSkeleton
        rows={5}
        cols={["w-[14%]", "w-[22%]", "w-[18%]", "w-[12%]", "ml-auto w-[84px]"]}
      />
    </div>
  );
}

/** Dashboard: four amount tiles, then the per-party breakdown. */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Right-aligned, matching the month picker it stands in for. A
          left-aligned placeholder would make the picker jump across the row
          the moment the data arrived. */}
      <Skeleton className="ml-auto h-9 w-[236px] rounded-[10px]" />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4">
            <Skeleton className="h-3 w-[68px]" />
            <Skeleton className="h-7 w-[104px]" />
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3.5 w-[110px]" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <Row key={i} cols={["w-[42%]", "w-[18%]", "ml-auto w-[92px]"]} />
        ))}
      </div>
    </div>
  );
}

/** A form screen: grouped fields and an action bar. */
export function FormPageSkeleton({ fields = 8 }: { fields?: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-1 flex-col gap-5 rounded-[14px] border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-[86px]" />
              <Skeleton className="h-[42px] w-full rounded-[10px]" />
            </div>
          ))}
        </div>
        <div className="mt-auto flex justify-end gap-2.5 pt-2">
          <Skeleton className="h-10 w-[92px] rounded-[14px]" />
          <Skeleton className="h-10 w-[120px] rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}

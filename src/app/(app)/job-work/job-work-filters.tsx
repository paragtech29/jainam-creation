"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * The filter panel from the owner's redesign: date range, party, karigar and
 * status, with a Clear all. Every value lives in the URL, so a refresh keeps
 * the view and it can be bookmarked.
 */
export function JobWorkFilters({
  parties,
  karigars,
}: {
  parties: { id: string; name: string }[];
  karigars: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = (k: string) => params.get(k) ?? "";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const active = ["from", "to", "party", "karigar", "status"].some((k) => get(k));

  const field = "h-10 rounded-[10px] border border-input bg-card px-2.5 text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const label = "text-xs font-medium text-secondary-foreground";

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-[14px_16px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
          Filters
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="grid gap-x-3 gap-y-2.5 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Date from</span>
          <input type="date" value={get("from")} onChange={(e) => set("from", e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Date to</span>
          <input type="date" value={get("to")} onChange={(e) => set("to", e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Party name</span>
          <select value={get("party")} onChange={(e) => set("party", e.target.value)} className={field}>
            <option value="">All parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Silai karigar name</span>
          <select value={get("karigar")} onChange={(e) => set("karigar", e.target.value)} className={field}>
            <option value="">All karigars</option>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Status</span>
          <select value={get("status")} onChange={(e) => set("status", e.target.value)} className={field}>
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Bill status</span>
          <select value={get("billed")} onChange={(e) => set("billed", e.target.value)} className={field}>
            <option value="">Any</option>
            <option value="yes">Billed</option>
            <option value="no">Not billed</option>
          </select>
        </label>
      </div>
    </div>
  );
}

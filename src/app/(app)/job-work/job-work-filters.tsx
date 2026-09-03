"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { SimpleSelect } from "@/components/ui/simple-select";

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

  const active = ["q", "from", "to", "party", "karigar", "status", "billed"].some((k) => get(k));

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

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        {/* Search sits with the other filters rather than floating above them —
            it is the same act, narrowing the list. Given two columns because
            a chalan or design number needs the room. */}
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:max-w-[320px]">
          <span className={label}>Search</span>
          <SearchInput
            placeholder="Chalan no., design no., party or karigar"
            className="w-full max-w-none"
            height="h-10"
          />
        </label>

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
          <SimpleSelect
            value={get("party") || "all"}
            onValueChange={(v) => set("party", v === "all" ? "" : v)}
            ariaLabel="Filter by party"
            className="h-10"
            options={[{ value: "all", label: "All parties" }, ...parties.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Silai karigar name</span>
          <SimpleSelect
            value={get("karigar") || "all"}
            onValueChange={(v) => set("karigar", v === "all" ? "" : v)}
            ariaLabel="Filter by silai karigar"
            className="h-10"
            options={[{ value: "all", label: "All karigars" }, ...karigars.map((k) => ({ value: k.id, label: k.name }))]}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Status</span>
          <SimpleSelect
            value={get("status") || "any"}
            onValueChange={(v) => set("status", v === "any" ? "" : v)}
            ariaLabel="Filter by job work status"
            className="h-10"
            options={[
              { value: "any", label: "Any status" },
              { value: "PENDING", label: "Pending" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Bill status</span>
          <SimpleSelect
            value={get("billed") || "any"}
            onValueChange={(v) => set("billed", v === "any" ? "" : v)}
            ariaLabel="Filter by bill status"
            className="h-10"
            options={[
              { value: "any", label: "Any" },
              { value: "yes", label: "Billed" },
              { value: "no", label: "Not billed" },
            ]}
          />
        </label>
      </div>
    </div>
  );
}

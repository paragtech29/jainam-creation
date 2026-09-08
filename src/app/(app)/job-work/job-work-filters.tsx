"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
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

  const [open, setOpen] = useState(false);

  const activeKeys = ["q", "from", "to", "party", "karigar", "status", "billed"].filter((k) => get(k));
  const active = activeKeys.length > 0;

  const label = "text-xs font-medium text-secondary-foreground";
  // Every dropdown gets the SAME width. They were sizing themselves to their
  // own content, so the row came out ragged — Status wide, Bill status narrow.
  const dropdown = "flex w-[184px] flex-col gap-1.5";
  // A date input is wider than its text: the picker icon and the dd/mm/yyyy
  // placeholder both need room, and Chrome will not shrink below that.
  const dateInput =
    "w-[112px] shrink-0 bg-transparent text-[13.5px] text-foreground outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer";

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-[14px_16px]">
      {/* No title on a laptop — a row of labelled fields does not need to be
          told it is a filter. This row then carries only Clear all, and only
          while something is active; otherwise it vanishes at desktop width and
          the card is just its fields. On a phone the row always stays, because
          there the "Filters" button is not a heading but the disclosure
          control for a panel that would otherwise bury the list. */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${active ? "" : "sm:hidden"}`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="job-work-filter-fields"
          className="-m-1 flex items-center gap-1.5 rounded p-1 text-[11px] font-medium uppercase tracking-[0.11em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          Filters
          {active ? (
            <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold tracking-normal text-brand-dark">
              {activeKeys.length}
            </span>
          ) : null}
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`transition-transform sm:hidden ${open ? "rotate-180" : ""}`}
          />
        </button>
        {active ? (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="ml-auto text-[12.5px] font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div
        id="job-work-filter-fields"
        className={`flex-wrap items-end gap-x-3 gap-y-2.5 sm:flex ${open ? "flex" : "hidden"}`}
      >
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

        <div className="flex flex-col gap-1.5">
          <span className={label}>Date range</span>
          <div className="flex h-10 items-center gap-1 rounded-[10px] border border-input bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring">
            <input
              type="date"
              aria-label="Date from"
              value={get("from")}
              max={get("to") || undefined}
              onChange={(e) => set("from", e.target.value)}
              className={dateInput}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <input
              type="date"
              aria-label="Date to"
              value={get("to")}
              min={get("from") || undefined}
              onChange={(e) => set("to", e.target.value)}
              className={dateInput}
            />
          </div>
        </div>

        <label className={dropdown}>
          <span className={label}>Party</span>
          <SimpleSelect
            value={get("party") || "all"}
            onValueChange={(v) => set("party", v === "all" ? "" : v)}
            ariaLabel="Filter by party"
            className="h-10"
            fullWidth
            options={[{ value: "all", label: "All parties" }, ...parties.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </label>

        <label className={dropdown}>
          <span className={label}>Silai karigar</span>
          <SimpleSelect
            value={get("karigar") || "all"}
            onValueChange={(v) => set("karigar", v === "all" ? "" : v)}
            ariaLabel="Filter by silai karigar"
            className="h-10"
            fullWidth
            options={[{ value: "all", label: "All karigars" }, ...karigars.map((k) => ({ value: k.id, label: k.name }))]}
          />
        </label>

        <label className={dropdown}>
          <span className={label}>Status</span>
          <SimpleSelect
            value={get("status") || "any"}
            onValueChange={(v) => set("status", v === "any" ? "" : v)}
            ariaLabel="Filter by job work status"
            className="h-10"
            fullWidth
            options={[
              { value: "any", label: "Any status" },
              { value: "PENDING", label: "Pending" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
        </label>

        <label className={dropdown}>
          <span className={label}>Bill status</span>
          <SimpleSelect
            value={get("billed") || "any"}
            onValueChange={(v) => set("billed", v === "any" ? "" : v)}
            ariaLabel="Filter by bill status"
            className="h-10"
            fullWidth
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

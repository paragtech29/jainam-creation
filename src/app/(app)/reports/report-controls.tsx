"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SimpleSelect } from "@/components/ui/simple-select";
import { GROUP_LABELS } from "@/lib/report-period";
import type { ReportView } from "@/lib/report-period";

/**
 * What the report is looking at: a period and a grouping.
 *
 * Everything lives in the URL, like the job work filters and the dashboard's
 * month — a report he can bookmark, refresh, or send to himself is worth more
 * than one held in component state. It also means the export can be handed the
 * very same query string and cannot disagree with the screen.
 */
export function ReportControls({ view, years }: { view: ReportView; years: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const label = "text-xs font-medium text-secondary-foreground";
  const field =
    "h-10 rounded-[10px] border border-input bg-card px-2.5 text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5 rounded-[14px] border border-border bg-card p-[14px_16px]">
      <label className="flex w-[132px] flex-col gap-1.5">
        <span className={label}>Period</span>
        <SimpleSelect
          value={view.period}
          onValueChange={(v) => set({ period: v })}
          ariaLabel="Report period"
          className="h-10 w-full"
          options={[
            { value: "month", label: "A month" },
            { value: "year", label: "A year" },
            { value: "custom", label: "Custom dates" },
          ]}
        />
      </label>

      {view.period === "month" ? (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Month</span>
          <input
            type="month"
            value={view.month}
            onChange={(e) => set({ month: e.target.value })}
            className={`${field} w-[168px]`}
          />
        </label>
      ) : null}

      {view.period === "year" ? (
        <label className="flex w-[132px] flex-col gap-1.5">
          <span className={label}>Year</span>
          <SimpleSelect
            value={view.year}
            onValueChange={(v) => set({ year: v })}
            ariaLabel="Report year"
            className="h-10 w-full"
            options={years.map((y) => ({ value: y, label: y }))}
          />
        </label>
      ) : null}

      {view.period === "custom" ? (
        <div className="flex flex-col gap-1.5">
          <span className={label}>Dates</span>
          <div className="flex h-10 items-center gap-1 rounded-[10px] border border-input bg-card px-2.5 focus-within:ring-2 focus-within:ring-ring">
            <input
              type="date"
              aria-label="From"
              value={view.from}
              max={view.to}
              onChange={(e) => set({ from: e.target.value })}
              className="w-[112px] shrink-0 bg-transparent text-[13.5px] text-foreground outline-none"
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <input
              type="date"
              aria-label="To"
              value={view.to}
              min={view.from}
              onChange={(e) => set({ to: e.target.value })}
              className="w-[112px] shrink-0 bg-transparent text-[13.5px] text-foreground outline-none"
            />
          </div>
        </div>
      ) : null}

      <label className="flex w-[184px] flex-col gap-1.5">
        <span className={label}>Show</span>
        <SimpleSelect
          value={view.groupBy}
          onValueChange={(v) => set({ groupBy: v })}
          ariaLabel="Group the report by"
          className="h-10 w-full"
          options={(["party", "karigar", "month", "none"] as const).map((g) => ({
            value: g,
            label: GROUP_LABELS[g],
          }))}
        />
      </label>
    </div>
  );
}

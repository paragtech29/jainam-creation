"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Active / Archived / All, in the URL. Defaults to Active — the archived
 * records are the exception, so they should be the thing you ask for rather
 * than the thing you switch off.
 */
export function ArchivedFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("archived") ?? "active";

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "active") next.delete("archived");
    else next.set("archived", value);
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-[12.5px] text-secondary-foreground">Show</span>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        aria-label="Filter by archived state"
        className="h-[42px] min-w-[130px] rounded-[10px] border border-input bg-card px-2.5 text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>
    </label>
  );
}

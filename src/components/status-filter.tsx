"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SimpleSelect } from "@/components/ui/simple-select";

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
      <SimpleSelect
        value={current}
        onValueChange={change}
        ariaLabel="Filter by archived state"
        options={[
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
          { value: "all", label: "All" },
        ]}
      />
    </label>
  );
}

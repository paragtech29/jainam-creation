"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

// The header would read as dead air with a single control floating on the
// right, so it carries the current section name on the left. It is a label,
// not a control — Profile remains the only thing in the header you can click.
export function PageTitle() {
  const pathname = usePathname();
  const match = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  );
  const title = match?.title ?? (pathname.startsWith("/settings") ? "Settings" : "");

  return (
    <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
      {title}
    </span>
  );
}

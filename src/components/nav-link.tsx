"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/**
 * Sidebar navigation, on the dark rail.
 *
 * Active is a solid brand pill; inactive is muted teal-grey text. Counts sit
 * on the right as quiet badges so the owner can see the shape of his data
 * without opening anything.
 */
export function NavLinks({
  counts,
  onNavigate,
}: {
  counts?: Partial<Record<string, number>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      <span className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-label">
        Workspace
      </span>

      {NAV_ITEMS.map(({ title, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const badge = counts?.[href];

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            )}
          >
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{title}</span>
            {badge != null ? (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-[11px] font-semibold tabular-nums",
                  active ? "bg-white/16 text-white" : "bg-white/[0.07] text-sidebar-meta"
                )}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

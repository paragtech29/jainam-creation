"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavPendingReporter } from "./nav-progress";
import { NAV_ITEMS } from "./nav-items";

/**
 * A spinner that appears only while THIS link's navigation is in flight.
 *
 * useLinkStatus reads the pending state of the enclosing Link, so it has to be
 * rendered as a descendant of it — that is the whole reason this is a separate
 * component rather than a hook call in the loop above.
 *
 * It is here because the skeletons alone do not cover the first moment. A tap
 * has to answer immediately, and on a slow phone connection the gap between
 * the tap and the new route committing is exactly when the owner concluded
 * that navigation was broken and started tapping other tabs.
 */
function NavPending({ href }: { href: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {/* Also reported to the shell, which runs a progress bar across the top
          of the app. The spinner alone sits inside a drawer that closes the
          instant you tap, so on a phone it can vanish before it is seen. */}
      <NavPendingReporter href={href} pending={pending} />
      {pending ? (
        <Loader2 size={14} className="shrink-0 animate-spin opacity-80" aria-hidden="true" />
      ) : null}
    </>
  );
}

/**
 * Sidebar navigation, on the dark rail.
 *
 * Active is a solid brand pill; inactive is muted teal-grey text. No record
 * counts: the owner asked for them gone, and they were the only reason the
 * layout queried parties and karigars on every page load.
 *
 * Each link answers a tap three ways, deliberately overlapping so there is no
 * silent gap: the browser's own :active tint on touch-down, a per-link spinner
 * while the navigation is in flight, and then the route's loading.tsx skeleton
 * once it commits.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      <span className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-label">
        Workspace
      </span>

      {NAV_ITEMS.map(({ title, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-sm font-medium transition-colors",
              // Touch-down feedback, painted by the browser before any
              // JavaScript runs — the tap is acknowledged even if the network
              // is slow.
              "active:bg-sidebar-accent active:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            )}
          >
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{title}</span>
            <NavPending href={href} />
          </Link>
        );
      })}
    </nav>
  );
}

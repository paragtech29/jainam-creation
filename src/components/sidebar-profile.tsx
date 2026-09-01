"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";

/**
 * The account block, pinned to the bottom of the sidebar rather than living
 * in the header. Puts identity where navigation is, and leaves the header
 * free to carry the page title and its primary action.
 */
export function SidebarProfile({
  username,
  logoutAction,
}: {
  username: string;
  logoutAction: () => Promise<void>;
}) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border pt-3">
      <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {initials}
      </div>

      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-medium text-white">{username}</span>
        <span className="text-[11px] text-sidebar-meta">Owner</span>
      </div>

      <Link
        href="/settings"
        
        aria-label="Change password"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-meta transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <KeyRound size={15} aria-hidden="true" />
      </Link>

      <form action={logoutAction}>
        <button
          type="submit"
          
          aria-label="Sign out"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-meta transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

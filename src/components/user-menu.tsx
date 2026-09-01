"use client";

import { KeyRound, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Radix gives keyboard navigation, Escape-to-close, focus return to the trigger
// and correct menu/menuitem roles for free — none of that is hand-rolled here.
export function UserMenu({
  username,
  logoutAction,
}: {
  username: string;
  logoutAction: () => Promise<void>;
}) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Avatar className="size-8 border border-border">
          <AvatarFallback className="bg-brand text-xs font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Open profile menu</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{username}</span>
          <span className="block text-xs text-muted-foreground">Signed in</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-9 cursor-pointer">
          <Link href="/settings">
            <KeyRound size={16} aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-9 cursor-pointer text-destructive focus:text-destructive">
          <form action={logoutAction} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut size={16} aria-hidden="true" />
              Log out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

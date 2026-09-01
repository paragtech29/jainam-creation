"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLockup } from "./brand-mark";
import { NavLinks } from "./nav-link";

// Slides from the left, matching where the sidebar lives on desktop. Radix
// Dialog underneath handles focus trap, Escape, scroll lock and returning
// focus to the hamburger on close.
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[85vw] max-w-[300px] p-0">
        <SheetHeader className="h-16 justify-center border-b border-border px-4">
          <SheetTitle asChild>
            <BrandLockup />
          </SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

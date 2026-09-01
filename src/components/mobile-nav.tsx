"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLockup } from "./brand-mark";
import { NavLinks } from "./nav-link";

// The same dark rail, slid in from the left on a phone. Radix Dialog beneath
// gives focus trap, Escape, scroll lock and focus restore for free.
export function MobileNav({
  counts,
  profile,
}: {
  counts?: Partial<Record<string, number>>;
  profile?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex size-[38px] items-center justify-center rounded-[10px] border border-input bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={19} aria-hidden="true" />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-[250px] flex-col gap-6 border-0 bg-sidebar p-[18px_14px]"
      >
        <div className="flex items-center gap-2.5">
          <SheetTitle asChild>
            <BrandLockup onDark />
          </SheetTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-[#B9CFCB] transition-colors hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <NavLinks counts={counts} onNavigate={() => setOpen(false)} />
        {profile}
      </SheetContent>
    </Sheet>
  );
}

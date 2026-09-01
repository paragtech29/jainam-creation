"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

type Meta = { title: string; sub: string; action?: { label: string; href: string } };

// Route → header copy. Kept in one place so the header and the page can never
// disagree about what screen you are on.
function metaFor(pathname: string): Meta {
  if (pathname.startsWith("/parties/new")) return { title: "Add party", sub: "A business that gives you work" };
  if (pathname.startsWith("/parties/")) return { title: "Party", sub: "Details and linked karigars" };
  if (pathname === "/parties")
    return { title: "Parties", sub: "The businesses who give you work", action: { label: "Add party", href: "/parties/new" } };

  if (pathname.startsWith("/karigars/new")) return { title: "Add karigar", sub: "A silai karigar you collect maal from" };
  if (pathname.startsWith("/karigars/")) return { title: "Silai Karigar", sub: "Details and the parties they work for" };
  if (pathname === "/karigars")
    return { title: "Silai Karigar", sub: "The karigars you collect maal from", action: { label: "Add karigar", href: "/karigars/new" } };

  if (pathname.startsWith("/job-work/new")) return { title: "Record job work", sub: "Party, karigar, description and pieces" };
  if (pathname.startsWith("/job-work/")) return { title: "Job work", sub: "Edit this chalan" };
  if (pathname === "/job-work")
    return { title: "Job Work", sub: "Every chalan you take from a party", action: { label: "Add job work", href: "/job-work/new" } };

  if (pathname.startsWith("/settings")) return { title: "Settings", sub: "Your account" };

  return { title: "Dashboard", sub: "Everything moving through the shop today" };
}

export function PageHeaderBar({ mobileNav }: { mobileNav: React.ReactNode }) {
  const { title, sub, action } = metaFor(usePathname());

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3.5 border-b border-border bg-background/90 px-[22px] py-[13px] backdrop-blur-md">
      {mobileNav}

      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-base font-semibold tracking-tight">{title}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">{sub}</span>
      </div>

      {action ? (
        <Link
          href={action.href}
          className="inline-flex h-10 shrink-0 items-center gap-[7px] rounded-[10px] bg-primary px-[15px] text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus size={15} strokeWidth={2.3} aria-hidden="true" />
          <span className="whitespace-nowrap">{action.label}</span>
        </Link>
      ) : null}
    </header>
  );
}

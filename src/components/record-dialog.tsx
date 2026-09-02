"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A create form shown over the list it belongs to, rather than on its own
 * page. These records have four or five fields — a whole route for that left
 * a screen of empty space around a short form, and threw away the list you
 * were looking at.
 *
 * Open state lives in the URL (?new=1), so the header's action button stays a
 * plain link, the back gesture closes it, and the view is shareable. The
 * standalone /new route still works for a direct visit.
 *
 * Layout notes, both learned from real measurements rather than assumption:
 *
 * 1. DialogContent is a `grid` by default. Left as a grid with overflow-auto,
 *    the WHOLE dialog scrolls — title included. It is overridden to a flex
 *    column here: header fixed, body the only scrolling region.
 *
 * 2. The body padding is `p-5 sm:p-6`, deliberately IDENTICAL to the card
 *    containers the same forms render inside. Those forms bleed their footer
 *    bar to the container edge with `-mx-5 sm:-mx-6`; when the body was a flat
 *    `px-5`, the footer was 4px wider than its parent at >=640px and produced
 *    a horizontal scrollbar.
 */
export function RecordDialog({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dialog open onOpenChange={(o) => !o && router.replace(pathname, { scroll: false })}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-[12.5px]">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

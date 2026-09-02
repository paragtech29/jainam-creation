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
 * a screen of empty space around a short form, and lost the list behind it.
 *
 * Open state lives in the URL (?new=1), so the header's action button is
 * still a plain link, the back gesture closes it, and the view is shareable.
 * The standalone /new route still exists as a fallback for a direct visit.
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
      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-[12.5px]">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="px-5 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

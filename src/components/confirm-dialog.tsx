"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Are you sure?" — wearing the SAME chrome as the record dialogs.
 *
 * It exists as its own component for one reason: the confirm used the bare
 * `DialogContent` defaults (a flat `p-4` box, `h-8` buttons) while the add /
 * edit dialogs had a bordered header, a padded body and a muted footer bar
 * with `h-10` buttons. Two dialogs a click apart looked like they came from
 * two different applications, and the small squat buttons read as far more
 * rounded than the primary ones because 14px of radius on a 32px-tall button
 * is nearly a pill, while on a 40px one it is a corner.
 *
 * So the bands, the paddings, the radius and the button metrics are all taken
 * from `RecordDialog` and the form action bar deliberately. Anything that
 * changes there must change here — that is the point of them being one
 * component each rather than one shared abstraction: the two are different
 * shapes (a form scrolls, a question does not), but they must read as siblings.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  /** Solid red rather than solid teal. Reserved for permanent removal. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          <DialogDescription className="text-[13px] leading-relaxed">{body}</DialogDescription>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={cn(
              "h-10 px-5",
              // The shared `destructive` variant is a TINT (destructive/10),
              // which is right for a link-like control in a row but reads as
              // secondary next to Cancel — and the confirm is the primary
              // action of this dialog even when it is the dangerous one.
              destructive && "bg-destructive text-white hover:bg-destructive/90"
            )}
          >
            {pending ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

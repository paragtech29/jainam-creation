"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Pending = "archive" | "unarchive" | "delete" | null;

/**
 * Archive / unarchive / delete, as icon buttons on a list row.
 *
 * Both destructive-ish actions confirm first — but they say different things,
 * because they ARE different: archiving is reversible and keeps history,
 * deleting is permanent. Delete is only rendered when the record has no job
 * works at all, so the "permanent" wording is always literally true.
 */
export function RowActions({
  name,
  noun,
  isArchived,
  canDelete,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  name: string;
  noun: string;
  isArchived: boolean;
  canDelete: boolean;
  onArchive: () => Promise<void>;
  onUnarchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      setConfirming(null);
    });
  }

  const iconBtn =
    "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

  return (
    <>
      <div className="flex items-center gap-0.5">
        {isArchived ? (
          <button
            type="button"
            onClick={() => setConfirming("unarchive")}
            aria-label={`Unarchive ${name}`}
            title="Unarchive"
            className={iconBtn}
          >
            <ArchiveRestore size={16} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming("archive")}
            aria-label={`Archive ${name}`}
            title="Archive"
            className={iconBtn}
          >
            <Archive size={16} aria-hidden="true" />
          </button>
        )}

        {/* Absent, not disabled, when the record has job works — a button that
            exists only to refuse you is worse than no button. */}
        {canDelete ? (
          <button
            type="button"
            onClick={() => setConfirming("delete")}
            aria-label={`Delete ${name}`}
            title="Delete"
            className={`${iconBtn} hover:bg-destructive/10 hover:text-destructive`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirming === "delete"
                ? `Delete ${name}?`
                : confirming === "unarchive"
                  ? `Unarchive ${name}?`
                  : `Archive ${name}?`}
            </DialogTitle>
            <DialogDescription>
              {confirming === "delete"
                ? `This permanently removes ${name}. It has no job works, so nothing else is affected. This cannot be undone.`
                : confirming === "unarchive"
                  ? `${name} will be offered again when you record a job work.`
                  : `${name} stops being offered on new job works. Existing job works are not changed, and you can unarchive at any time.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirming === "delete" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() =>
                run(
                  confirming === "delete"
                    ? onDelete
                    : confirming === "unarchive"
                      ? onUnarchive
                      : onArchive
                )
              }
            >
              {isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Working…
                </>
              ) : confirming === "delete" ? (
                `Delete ${noun}`
              ) : confirming === "unarchive" ? (
                "Unarchive"
              ) : (
                "Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

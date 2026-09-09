"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteJobWorkAction } from "./actions";

/**
 * Delete, in the form's own action bar beside Save changes.
 *
 * It replaces a "Danger zone" card below the form — a second card, a
 * separator and a heading for one button, which put the control furthest from
 * the actions it belongs with and named a feeling rather than an action.
 *
 * The confirmation is the app's shared ConfirmDialog, so this asks in exactly
 * the same words and shape as archiving a party. The old version asked with a
 * bare inline paragraph and two full-width buttons, which is a third pattern
 * for the same question.
 */
export function DeleteJobWorkButton({ jobWorkId }: { jobWorkId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteJobWorkAction(jobWorkId);
      // On success the action redirects, which throws NEXT_REDIRECT and never
      // reaches here. Anything returned is a failure.
      if (result && "error" in result) {
        setError(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        className="h-10 px-4"
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete
      </Button>

      {error ? (
        <span role="alert" className="text-[12.5px] text-destructive">
          {error}
        </span>
      ) : null}

      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title="Delete this job work?"
        body="This job work and its work breakdown will be removed permanently. This cannot be undone."
        confirmLabel="Delete job work"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}

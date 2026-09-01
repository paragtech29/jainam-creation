"use client";

// Two-step native confirmation, the proven pattern from
// karigars/[id]/karigar-record-actions.tsx. A job work is a leaf record —
// unlike parties and karigars there is no archive concept and no
// "cannot delete, it has dependents" rule, so this component only ever
// renders the delete control.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { deleteJobWorkAction } from "../actions";

function DeleteConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="h-11 w-full text-base"
    >
      {pending ? "Deleting..." : "Yes, delete"}
    </Button>
  );
}

export function JobWorkRecordActions({ jobWorkId }: { jobWorkId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleDelete() {
    const result = await deleteJobWorkAction(jobWorkId);
    // On success deleteJobWorkAction redirects, throwing NEXT_REDIRECT —
    // this line only runs when it returns an error instead.
    if (result && "error" in result) {
      setError(result.error);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Separator />
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Danger zone</h2>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!confirming ? (
          <Button
            type="button"
            variant="destructive"
            className="h-11 w-full text-base"
            onClick={() => setConfirming(true)}
          >
            Delete job work
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              Are you sure? This job work and its description lines will be removed permanently.
            </p>
            <div className="flex gap-2">
              <form action={handleDelete} className="w-full">
                <DeleteConfirmButton />
              </form>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full text-base"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

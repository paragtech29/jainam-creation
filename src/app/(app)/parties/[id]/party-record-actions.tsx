"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  archivePartyAction,
  unarchivePartyAction,
  deletePartyAction,
} from "../actions";

function ArchiveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="h-11 w-full text-base">
      {pending ? "Archiving..." : "Archive"}
    </Button>
  );
}

function UnarchiveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full text-base">
      {pending ? "Unarchiving..." : "Unarchive"}
    </Button>
  );
}

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

export function PartyRecordActions({
  partyId,
  isArchived,
  canDelete,
}: {
  partyId: string;
  isArchived: boolean;
  canDelete: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  async function handleDelete() {
    const result = await deletePartyAction(partyId);
    if (result && "error" in result) {
      setDeleteError(result.error);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isArchived ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Archived</span>
          <form action={unarchivePartyAction.bind(null, partyId)}>
            <UnarchiveButton />
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <form action={archivePartyAction.bind(null, partyId)}>
            <ArchiveButton />
          </form>
          <p className="text-sm text-muted-foreground">
            Archiving hides this party from new job work dropdowns. Its existing job works stay
            exactly as they are.
          </p>
        </div>
      )}

      {canDelete ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground">Danger zone</h2>
            <p className="text-sm text-muted-foreground">
              This party has no job works, so it can be deleted permanently.
            </p>
            {deleteError ? (
              <p role="alert" className="text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}
            {!confirmingDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full text-base"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete party
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground">Are you sure?</p>
                <div className="flex gap-2">
                  <form action={handleDelete} className="w-full">
                    <DeleteConfirmButton />
                  </form>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full text-base"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

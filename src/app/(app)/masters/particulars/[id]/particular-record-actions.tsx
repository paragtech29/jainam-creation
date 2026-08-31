"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  archiveParticularAction,
  unarchiveParticularAction,
  deleteParticularAction,
} from "../actions";

export function ParticularRecordActions({
  particularId,
  isArchived,
  canDelete,
}: {
  particularId: string;
  isArchived: boolean;
  canDelete: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {isArchived ? (
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Archived
          </span>
          <form action={unarchiveParticularAction.bind(null, particularId)}>
            <Button type="submit" variant="outline" className="h-11 text-base">
              Unarchive
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <form action={archiveParticularAction.bind(null, particularId)}>
            <Button type="submit" variant="outline" className="h-11 text-base">
              Archive
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Archiving hides this particular from new job works. Job works that already use it are
            unchanged.
          </p>
        </div>
      )}

      {canDelete ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              This particular is not used on any job work, so it can be deleted permanently.
            </p>
            {!confirmingDelete ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 text-base"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete particular
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Are you sure?</p>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      await deleteParticularAction(particularId);
                    }}
                  >
                    <Button type="submit" variant="destructive" className="h-11 text-base">
                      Yes, delete
                    </Button>
                  </form>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 text-base"
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

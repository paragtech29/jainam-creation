"use client";

import { RecordDialog } from "@/components/record-dialog";
import { useRecordDialog } from "@/components/record-dialog-store";
import { PartyForm } from "./party-form";
import type { PartyListRow } from "@/lib/db/repositories/parties";

/**
 * Hosts both party dialogs — create and edit — driven by client state rather
 * than the URL, because the owner did not want the address bar changing when
 * a modal opens.
 *
 * The record being edited comes straight from the row that was clicked, which
 * is why listPartiesPage selects every editable column: no second query, no
 * loading state inside the dialog.
 */
export function PartyDialogs({ rows }: { rows: PartyListRow[] }) {
  const { kind, id } = useRecordDialog();
  if (kind !== "party") return null;

  const editing = id ? rows.find((r) => r.id === id) : null;

  // An id that is not on this page (a stale click after the list moved on)
  // shows nothing rather than an empty form pretending to be a record.
  if (id && !editing) return null;

  return editing ? (
    <RecordDialog
      title={`Edit ${editing.name}`}
      description="Change what you need and save. Linking silai karigars is done on the karigar."
    >
      <PartyForm
        party={{
          id: editing.id,
          name: editing.name,
          ownerName1: editing.ownerName1,
          ownerName2: editing.ownerName2,
          address: editing.address,
          gender: editing.gender,
          email: editing.email,
          contact1: editing.contact1,
          contact2: editing.contact2,
        }}
      />
    </RecordDialog>
  ) : (
    <RecordDialog
      title="Add party"
      description="Party name, owner name, contact number and gender are required."
    >
      <PartyForm />
    </RecordDialog>
  );
}

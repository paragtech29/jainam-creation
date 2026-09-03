"use client";

import { RecordDialog } from "@/components/record-dialog";
import { useRecordDialog } from "@/components/record-dialog-store";
import { KarigarForm } from "./karigar-form";
import type { KarigarListRow } from "@/lib/db/repositories/karigars";

/**
 * Both karigar dialogs, create and edit, on client state rather than the URL.
 *
 * Unlike the party form, this one also owns the party links — the checklist of
 * who this karigar sews for — so `linkedPartyIds` has to come in with the
 * rows. The page loads them in one query and groups them by karigar.
 */
export function KarigarDialogs({
  rows,
  parties,
  linksByKarigar,
}: {
  rows: KarigarListRow[];
  parties: { id: string; name: string }[];
  linksByKarigar: Record<string, string[]>;
}) {
  const { kind, id } = useRecordDialog();
  if (kind !== "karigar") return null;

  const editing = id ? rows.find((r) => r.id === id) : null;
  if (id && !editing) return null;

  return editing ? (
    <RecordDialog
      title={`Edit ${editing.name}`}
      description="Change the details, or tick which parties this karigar works for."
    >
      <KarigarForm
        karigar={{
          id: editing.id,
          name: editing.name,
          address: editing.address,
          contact1: editing.contact1,
          contact2: editing.contact2,
        }}
        parties={parties}
        linkedPartyIds={linksByKarigar[editing.id] ?? []}
      />
    </RecordDialog>
  ) : (
    <RecordDialog
      title="Add karigar"
      description="Only the name is required. You can fill in the rest later."
    >
      <KarigarForm parties={parties} />
    </RecordDialog>
  );
}

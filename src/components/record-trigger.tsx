"use client";

import { openRecordDialog, type RecordDialogKind } from "@/components/record-dialog-store";

/**
 * A button that opens a record dialog. Exists so a server-rendered list row
 * can hand off the click without the whole list becoming a client component.
 *
 * It is a real <button>, not a styled div: it needs keyboard focus and Enter
 * to work, which a list row previously got for free from being a link.
 */
export function RecordTrigger({
  kind,
  id,
  className,
  ariaLabel,
  children,
}: {
  kind: RecordDialogKind;
  /** Omit to open the create dialog. */
  id?: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openRecordDialog(kind, id)} aria-label={ariaLabel} className={className}>
      {children}
    </button>
  );
}

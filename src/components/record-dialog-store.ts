"use client";

import { useSyncExternalStore } from "react";

/**
 * Which record dialog is open, held in plain client state.
 *
 * The dialogs used to be driven by the URL (`?new=1`, `?edit=<id>`), for one
 * concrete reason: the page header's "Add party" button lives in a different
 * component tree from the page that owns the dialog, and a URL is the one
 * thing both can see without shared state. The owner did not want the address
 * bar changing when a modal opens, so this tiny store is that shared state
 * instead.
 *
 * What that choice costs, recorded so it is not rediscovered as a bug: the
 * phone's BACK gesture no longer closes the dialog — it leaves the list.
 * Escape and the close button still work. Reverting would mean putting the
 * parameter back.
 *
 * A module-level store rather than React context because the trigger and the
 * dialog have no common ancestor below the app layout, and adding a provider
 * up there would make every page pay for it. No new dependency either.
 */
export type RecordDialogKind = "party" | "karigar";

type State = { kind: RecordDialogKind | null; id: string | null };

const CLOSED: State = { kind: null, id: null };

let state: State = CLOSED;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Open the create dialog (no id) or the edit dialog for one record. */
export function openRecordDialog(kind: RecordDialogKind, id?: string) {
  state = { kind, id: id ?? null };
  emit();
}

export function closeRecordDialog() {
  state = CLOSED;
  emit();
}

export function useRecordDialog(): State {
  // getServerSnapshot returns the closed state so the server renders no
  // dialog and hydration matches.
  return useSyncExternalStore(subscribe, () => state, () => CLOSED);
}

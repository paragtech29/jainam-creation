"use client";

import { useRef, useState } from "react";

/**
 * Has anything in this form actually changed?
 *
 * Used to keep "Save changes" disabled until there is a change to save — the
 * owner's point being that an enabled Save on an untouched form invites a
 * pointless write and makes you wonder whether you had edited something.
 *
 * Compares the live form against the values it opened with, read through
 * FormData so it sees exactly what would be posted. That covers text inputs,
 * textareas and the Radix Select dropdowns: Radix mirrors its value into a
 * hidden native <select> and dispatches a bubbling "change" event on it
 * (react-select/dist/index.mjs — `new Event("change", { bubbles: true })`),
 * so a form-level onChange notices a dropdown just as it notices typing.
 *
 * What it does NOT cover is a control that keeps its selection in React state
 * and renders hidden inputs, because nothing user-driven fires there —
 * MultiSelect is the one such control, and it reports changes through its own
 * onSelectionChange callback instead.
 */
export function useDirtyFields(initial: Record<string, string>) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [dirty, setDirty] = useState(false);

  /** Re-read the form and update `dirty`. Safe to call on every keystroke. */
  function recheck() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setDirty(
      Object.entries(initial).some(([field, was]) => String(data.get(field) ?? "") !== was)
    );
  }

  /** For controls that cannot be read from FormData — see the note above. */
  function markDirty() {
    setDirty(true);
  }

  return { formRef, dirty, recheck, markDirty };
}

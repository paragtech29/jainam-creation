"use client";

// Draft persistence for the job work form (JOB-14). A half-filled form must
// survive an accidental refresh or an Android/iOS back-gesture navigation —
// this is 03-CONTEXT.md's exact scenario for an owner standing in a market.
//
// sessionStorage, NOT localStorage: a form drafted three days ago silently
// reappearing over a fresh, blank form is worse than losing it. sessionStorage
// is cleared when the tab/app is fully closed, which is the correct lifetime
// for "one continuous session filling one form" — see 03-RESEARCH.md's
// "Draft persistence" section.
//
// Deliberately NO `beforeunload` handler: 03-RESEARCH.md found mobile Safari
// and Chrome suppress/ignore `beforeunload` unreliably (especially on a back
// gesture, which is exactly the case this hook exists for), so a "leave
// site?" warning would be a false promise. The sessionStorage
// restore-on-mount below is the actual safety net; write-on-change plus
// restore-on-mount covers the requirement without depending on an unreliable
// browser event.
//
// Key convention: callers MUST use `jobwork-draft-new` for the create form
// and `jobwork-draft-edit-{id}` for an edit of a specific job work — two
// different job works being edited in the same tab (e.g. via back/forward)
// must never share, or clobber, each other's draft.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// True only once hydration is done. useSyncExternalStore is the hydration-
// safe way to ask this: React uses the server snapshot (false) for the
// hydration render, so the markup matches, then re-renders with the client
// snapshot (true). A plain `useState(false)` + `useEffect(() => setTrue())`
// would do the same job but is a setState inside an effect, which this
// codebase rejects outright.
const NEVER_CHANGES = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
}

export type JobWorkDraft = {
  date: string;
  partyId: string;
  karigarId: string;
  pieces: string;
  rate: string;
  rateTouched: boolean;
  chalanNo: string;
  partyDesignNo: string;
  computerDesignNo: string;
  comment: string;
  status: string;
  isBilled: boolean;
  rows: { descriptionTypeId: string; price: string }[];
};

export function useJobWorkDraft(
  key: string,
  initial: JobWorkDraft
): {
  draft: JobWorkDraft;
  setDraft: React.Dispatch<React.SetStateAction<JobWorkDraft>>;
  clearDraft: () => void;
} {
  // The saved draft is read AFTER mount, never in this initialiser.
  //
  // Reading sessionStorage here used to seem obvious — restore the draft
  // before the first paint and there is no flicker. But the server has no
  // sessionStorage, so it renders the blank form while the browser renders
  // the filled one, and React reports "Hydration failed because the server
  // rendered HTML didn't match the client" and THROWS AWAY the server markup
  // to re-render the whole form on the client. It fired on exactly the
  // journey this hook exists for: leave a half-filled form, come back to it.
  // Starting from `initial` makes the first client render match the server;
  // the restore just below then fills it in.
  const [draft, setDraft] = useState<JobWorkDraft>(initial);

  // Which key's draft has already been restored. State rather than a ref
  // because this is read during render, and it doubles as the guard for the
  // write-back below: nothing may be saved until the restore has had its
  // turn, or the blank first render would overwrite the very draft being
  // restored. Keying it also means a different job work restores its own
  // draft rather than keeping the previous one's.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const hydrated = useHydrated();
  const restored = restoredFor === key;

  // Adjusted during render, not in an effect: the update is queued before
  // this render commits, so the restored draft paints in the same frame
  // rather than as a visible second pass.
  if (hydrated && !restored) {
    setRestoredFor(key);
    try {
      const saved = sessionStorage.getItem(key);
      // A corrupt or half-written draft must degrade to the blank form,
      // never crash the screen — hence the try/catch around JSON.parse.
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<JobWorkDraft>;
        setDraft((d) => ({ ...d, ...parsed }));
      }
    } catch {
      // Leave the blank form standing.
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!restored) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(draft));
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, key, restored]);

  function clearDraft() {
    sessionStorage.removeItem(key);
  }

  return { draft, setDraft, clearDraft };
}

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
import { useEffect, useRef, useState } from "react";

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
  const [draft, setDraft] = useState<JobWorkDraft>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const saved = sessionStorage.getItem(key);
      // A corrupt or half-written draft must degrade to the blank form, never
      // crash the screen — hence the try/catch around JSON.parse.
      return saved ? { ...initial, ...JSON.parse(saved) } : initial;
    } catch {
      return initial;
    }
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(draft));
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, key]);

  function clearDraft() {
    sessionStorage.removeItem(key);
  }

  return { draft, setDraft, clearDraft };
}

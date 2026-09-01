"use client";

// The owner negotiates rates with parties. If he types 162 and then fixes a
// typo in a row price, 162 must still be 162. Anything that recomputes the
// rate without checking `touched` is a money bug — this is CONTEXT.md's
// single named highest-risk area in this entire phase.
//
// `touched` is an explicit boolean, never inferred by comparing `rate`
// against `computedSum`. Value-diffing cannot distinguish "never touched"
// from "touched, and currently happens to equal the sum" — the moment a
// manually-typed rate coincides with the row sum (easily possible), a
// value-diff approach would silently forget the override and start
// recalculating again on the next row edit. Only `resetToAuto` may ever
// set `touched` back to false.
//
// EDIT-PATH CONTRACT (03-05 must not miss this): when loading an existing
// job work, pass `initialTouched = storedRate !== sumOfStoredLinePrices`.
// A previously-saved override must reopen as still-an-override — otherwise
// reopening a job work to change one character in the comment would
// silently "fix" the owner's negotiated rate back to the row sum on save,
// because `rate` below is derived from `computedSum` whenever `touched`
// starts as `false`.
import { useState } from "react";

export function useDerivedRate(
  rowPrices: number[],
  initialRate?: number,
  initialTouched = false
): {
  rate: string;
  touched: boolean;
  computedSum: number;
  onRateChange: (value: string) => void;
  resetToAuto: () => void;
} {
  const computedSum = rowPrices.reduce((a, b) => a + b, 0);

  // `manualRate` only ever holds what the owner typed himself. `touched`
  // is the ONLY thing that decides whether it is shown. There is no effect
  // syncing `rate` to `computedSum` — instead `rate` is computed directly
  // during render (touched ? manualRate : sum), which is the same "derive,
  // don't store-then-sync" idiom React's own docs recommend for exactly
  // this shape of problem, and it sidesteps the class of bug an
  // effect-based sync invites: an effect that fires unconditionally on
  // every row change would eventually recompute `rate` from `computedSum`
  // even when `touched` briefly appears false during a render race,
  // whereas deriving during render can never "forget" to check `touched`
  // because there is no separate step where it could.
  const [manualRate, setManualRate] = useState<string>(String(initialRate ?? computedSum ?? ""));
  const [touched, setTouched] = useState(initialTouched);

  const rate = touched ? manualRate : String(computedSum);

  function onRateChange(value: string) {
    setManualRate(value);
    setTouched(true);
  }

  // The ONLY path back to auto. Never called automatically.
  function resetToAuto() {
    setTouched(false);
    setManualRate(String(computedSum));
  }

  return { rate, touched, computedSum, onRateChange, resetToAuto };
}

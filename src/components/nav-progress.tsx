"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * A thin progress bar across the top of the app while a navigation is in
 * flight.
 *
 * Why this exists ON TOP of the route skeletons, rather than instead of them.
 * Measured, not assumed: clicking a sidebar link with the server artificially
 * held for 2.5s, the per-link spinner appeared at 155ms but the URL stayed on
 * the old page and NO skeleton appeared until the response landed at 3.2s.
 * `loading.tsx` can only paint once the router commits the new route, and the
 * router cannot commit without a prefetched shell — and **Next disables link
 * prefetching in development**. So on the owner's own machine (he runs
 * `npm run dev`) the skeletons cover a full page load and a refresh, but a
 * sidebar tap would still have looked dead without this.
 *
 * The bar is deliberately not a spinner in the middle of the screen: it never
 * covers content, it reads the same on a phone as on a laptop, and it cannot
 * be mistaken for the page itself having loaded.
 *
 * State lives in a module store rather than context because the reporters (one
 * per nav link, in two separate trees — sidebar and mobile drawer) and the
 * reader (the shell) have no common provider. Same pattern as
 * record-dialog-store.
 */

const pendingHrefs = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by each nav link as its own pending state flips. */
export function reportNavPending(href: string, pending: boolean) {
  const had = pendingHrefs.size > 0;
  if (pending) pendingHrefs.add(href);
  else pendingHrefs.delete(href);
  if (had !== pendingHrefs.size > 0) emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const isNavigating = () => pendingHrefs.size > 0;

export function useNavPending() {
  // Server snapshot is false: nothing is navigating during the initial render.
  return useSyncExternalStore(subscribe, isNavigating, () => false);
}

/**
 * Reports one link's pending state into the store. Rendered inside a `Link`
 * by nav-link.tsx, which is where `useLinkStatus` is readable.
 */
export function NavPendingReporter({ href, pending }: { href: string; pending: boolean }) {
  useEffect(() => {
    reportNavPending(href, pending);
    // On unmount — which is what happens when the drawer closes mid-navigation
    // — the entry must go, or the bar would run forever.
    return () => reportNavPending(href, false);
  }, [href, pending]);

  return null;
}

export function NavProgress() {
  const navigating = useNavPending();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden"
    >
      <div
        className={
          navigating
            ? "nav-progress h-full w-full bg-primary"
            : "h-full w-full -translate-x-full bg-primary opacity-0"
        }
      />
    </div>
  );
}

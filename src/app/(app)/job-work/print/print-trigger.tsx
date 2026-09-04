"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * Opens the print dialog once the page has rendered, and leaves a button for
 * a second go.
 *
 * The rAF-then-timeout is not superstition: calling print() during the same
 * frame the page paints can capture a half-laid-out table in some browsers,
 * and the print preview then shows a broken column. Waiting a frame plus a
 * tick lets fonts settle first.
 */
export function PrintTrigger() {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const t = setTimeout(() => window.print(), 250);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="mx-auto flex max-w-[1000px] items-center justify-end gap-2 px-6 pt-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Printer size={15} aria-hidden="true" />
        Print / Save as PDF
      </button>
    </div>
  );
}

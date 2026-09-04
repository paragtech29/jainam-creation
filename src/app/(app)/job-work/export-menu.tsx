"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

/**
 * Export whatever the list is currently showing.
 *
 * It reads the SAME query string the list read, and hands it to the export
 * route and the print page unchanged. That is deliberate: the export cannot
 * disagree with the screen it was launched from, because there is only one
 * description of "the current view" and all three read it.
 *
 * Excel is a real file download from a route handler. PDF is the browser's
 * own print-to-PDF via a print-formatted page — the built-in PDF fonts have
 * no ₹ glyph, and shipping a font raised a licence question, so printing is
 * what renders ₹ correctly with nothing embedded.
 */
export function ExportMenu({ rowCount }: { rowCount: number }) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  // Everything except the page number: an export is the whole filtered set,
  // not the page you happen to be looking at.
  const qs = (() => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    next.delete("highlight");
    const s = next.toString();
    return s ? `?${s}` : "";
  })();

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:bg-muted";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download size={14} aria-hidden="true" />
        Export
      </button>

      {open ? (
        <>
          {/* Click-away. A plain overlay rather than a document listener, so
              there is nothing to leak if this unmounts mid-open. */}
          <button
            type="button"
            aria-label="Close export menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-1.5 w-[248px] overflow-hidden rounded-[10px] border border-border bg-popover shadow-card-hover">
            <p className="border-b border-border px-3 py-2 text-[11.5px] text-muted-foreground">
              {rowCount} {rowCount === 1 ? "entry" : "entries"} in this view
            </p>

            <a href={`/api/export/job-works${qs}`} className={item} onClick={() => setOpen(false)}>
              <FileSpreadsheet size={15} className="text-brand" aria-hidden="true" />
              <span>
                Excel
                <span className="block text-[11px] text-muted-foreground">
                  .xlsx with the grand total
                </span>
              </span>
            </a>

            <a
              href={`/job-work/print${qs}`}
              target="_blank"
              rel="noopener"
              className={item}
              onClick={() => setOpen(false)}
            >
              <Printer size={15} className="text-brand" aria-hidden="true" />
              <span>
                PDF
                <span className="block text-[11px] text-muted-foreground">
                  opens print → Save as PDF
                </span>
              </span>
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

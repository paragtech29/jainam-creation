"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
 *
 * WHY THE SHARED DROPDOWN AND NOT A HAND-ROLLED PANEL: this button lives in
 * the list's footer, pinned to the bottom of a shell that is `overflow-hidden`
 * by design. A plain `absolute … mt-1.5` panel opened DOWNWARD off the bottom
 * of the screen and was clipped — measured at 1440×900, the menu ran from
 * y=871 to y=1019 and the Excel row sat at y=906, entirely below the fold.
 * The owner reported export as broken, and from where he was sitting it was:
 * the only way to reach the item was to not be able to. Nothing was wrong with
 * the download itself, which is why it needed measuring rather than debugging.
 *
 * Radix's content is portalled and collision-aware, so it flips above the
 * button when there is no room below and cannot be clipped by an ancestor's
 * overflow. Any popover near the edge of this shell needs the same treatment.
 */
export function ExportMenu({ rowCount }: { rowCount: number }) {
  const params = useSearchParams();

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
    "flex w-full cursor-pointer items-start gap-2.5 rounded-none px-3 py-2.5 text-left text-[13px]";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Download size={14} aria-hidden="true" />
        Export
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[248px] overflow-hidden p-0">
        <p className="border-b border-border px-3 py-2 text-[11.5px] text-muted-foreground">
          {rowCount} {rowCount === 1 ? "entry" : "entries"} in this view
        </p>

        <DropdownMenuItem asChild className={item}>
          <a href={`/api/export/job-works${qs}`}>
            <FileSpreadsheet size={15} className="mt-0.5 text-brand" aria-hidden="true" />
            <span>
              Excel
              <span className="block text-[11px] text-muted-foreground">
                .xlsx with the grand total
              </span>
            </span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={item}>
          <a href={`/job-work/print${qs}`} target="_blank" rel="noopener">
            <Printer size={15} className="mt-0.5 text-brand" aria-hidden="true" />
            <span>
              PDF
              <span className="block text-[11px] text-muted-foreground">
                opens print → Save as PDF
              </span>
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

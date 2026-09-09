"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Excel or PDF, the same choice the job work list offers.
 *
 * Both are handed the SAME query string the page read, so neither can describe
 * a different period from the screen it was launched from.
 *
 * PDF is the browser's own print-to-PDF via a print-formatted page, not a
 * server-generated file: built-in PDF fonts have no ₹ glyph, and shipping a
 * font raised a licence question. Printing renders ₹ with the device's fonts
 * and embeds nothing.
 *
 * The shared DropdownMenu rather than a hand-rolled panel — its content is
 * portalled and collision-aware, so it flips rather than being clipped by an
 * ancestor's overflow. The export menu on the job work list was clipped off
 * the bottom of the screen for exactly that reason.
 */
export function ReportExportMenu({ qs, rowCount }: { qs: string; rowCount: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Download size={14} aria-hidden="true" />
        Export
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[248px] overflow-hidden p-0">
        <p className="border-b border-border px-3 py-2 text-[11.5px] text-muted-foreground">
          {rowCount} {rowCount === 1 ? "line" : "lines"} in this report
        </p>

        <DropdownMenuItem
          asChild
          className="flex w-full cursor-pointer items-start gap-2.5 rounded-none px-3 py-2.5 text-left text-[13px]"
        >
          <a href={`/api/export/report?${qs}`}>
            <FileSpreadsheet size={15} className="mt-0.5 text-brand" aria-hidden="true" />
            <span>
              Excel
              <span className="block text-[11px] text-muted-foreground">
                .xlsx with the grand total
              </span>
            </span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="flex w-full cursor-pointer items-start gap-2.5 rounded-none px-3 py-2.5 text-left text-[13px]"
        >
          <a href={`/reports/print?${qs}`} target="_blank" rel="noopener">
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

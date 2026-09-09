import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RowProgress } from "./row-progress";
import type { JobWorkListRow } from "@/lib/db/repositories/jobWorks";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatMoney(value: number) {
  return value.toLocaleString("en-IN");
}

export function JobWorkList({
  rows,
  highlight,
}: {
  rows: JobWorkListRow[];
  highlight?: string;
}) {
  return (
    <>
      {/* Phone */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <div
              className={cn(
                "flex flex-col rounded-lg border bg-card shadow-card transition-shadow hover:shadow-card-hover",
                highlight === r.id ? "border-brand ring-1 ring-brand" : "border-border"
              )}
            >
            <Link
              href={`/job-work/${r.id}`}
              className="flex min-h-[44px] flex-col gap-1.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>
              </div>
              <div className="min-w-0">
                <span className="truncate font-medium">{r.partyName}</span>
                <span className="text-muted-foreground"> · {r.karigarName}</span>
              </div>
              {/* Chalan only. The design numbers belong to the record, not to
                  the row you scan down — the owner reads a list by chalan. */}
              {r.chalanNo ? (
                <p className="text-xs text-muted-foreground">Chalan {r.chalanNo}</p>
              ) : null}
              <div className="tnum flex items-center justify-end gap-2 text-sm">
                <span className="text-muted-foreground">
                  {r.pieces} × ₹{r.rate}
                </span>
                <span className="font-medium text-foreground">₹{formatMoney(r.total)}</span>
              </div>
            </Link>

            {/* Outside the link on purpose: a dropdown inside an anchor is
                invalid HTML and every tap would follow the link instead. */}
            <div className="border-t border-border px-4 py-2.5">
              <RowProgress
                jobWorkId={r.id}
                status={r.status}
                isBilled={r.isBilled}
                partyName={r.partyName}
              />
            </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Laptop */}
      <div className="hidden rounded-lg border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-border bg-muted text-left shadow-[0_1px_0_var(--border)]">
              <th className="h-11 px-4 font-medium text-muted-foreground">Date</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Party</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Karigar</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Chalan</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Pieces × Rate</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Total</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Status &amp; bill</th>
              <th className="h-11 w-10 px-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                  highlight === r.id && "bg-accent/60"
                )}
              >
                <td className="h-12 px-4 text-muted-foreground">{formatDate(r.date)}</td>
                <td className="px-4">
                  <Link
                    href={`/job-work/${r.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {r.partyName}
                  </Link>
                </td>
                <td className="px-4 text-muted-foreground">{r.karigarName}</td>
                <td className="tnum px-4 text-xs text-muted-foreground">
                  {r.chalanNo || "—"}
                </td>
                <td className="tnum px-4 text-right text-muted-foreground">
                  {r.pieces} × ₹{r.rate}
                </td>
                <td className="tnum px-4 text-right font-medium text-foreground">
                  ₹{formatMoney(r.total)}
                </td>
                {/* Changeable from here: the common case is a row whose work
                    has moved on, and opening the form to change one word is
                    four clicks for a one-word change. */}
                <td className="px-4 py-2">
                  <RowProgress
                    jobWorkId={r.id}
                    status={r.status}
                    isBilled={r.isBilled}
                    partyName={r.partyName}
                  />
                </td>
                <td className="px-4 text-right">
                  <Link
                    href={`/job-work/${r.id}`}
                    aria-label={`Open job work for ${r.partyName}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PartyListRow } from "@/lib/db/repositories/parties";

// Two representations rather than one responsive table: a real table on the
// laptop, stacked cards on the phone. Horizontally scrolling a table one-handed
// in a market is the thing we are specifically avoiding.
export function PartyList({
  parties,
  highlight,
}: {
  parties: PartyListRow[];
  highlight?: string;
}) {
  return (
    <>
      {/* Phone */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {parties.map((p) => (
          <li key={p.id}>
            <Link
              href={`/parties/${p.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                highlight === p.id ? "border-brand ring-1 ring-brand" : "border-border"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.ownerName1}
                  {p.contact1 ? ` · ${p.contact1}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{p.jobWorkCount}</span>{" "}
                  {p.jobWorkCount === 1 ? "job work" : "job works"}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Laptop */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="h-11 px-4 font-medium text-muted-foreground">Party</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Owner</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Contact</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Job works</th>
              <th className="h-11 w-10 px-4" />
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                  highlight === p.id && "bg-accent/60"
                )}
              >
                <td className="h-12 px-4">
                  <Link
                    href={`/parties/${p.id}`}
                    className="flex items-center gap-2 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {p.name}
                    {p.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                  </Link>
                </td>
                <td className="px-4 text-muted-foreground">{p.ownerName1}</td>
                <td className="px-4 text-muted-foreground">{p.contact1 ?? "—"}</td>
                <td className="px-4 text-right font-mono tabular-nums text-muted-foreground">
                  {p.jobWorkCount}
                </td>
                <td className="px-4 text-right">
                  <Link
                    href={`/parties/${p.id}`}
                    aria-label={`Open ${p.name}`}
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

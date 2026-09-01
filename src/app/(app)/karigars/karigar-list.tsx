import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { KarigarListRow } from "@/lib/db/repositories/karigars";

export function KarigarList({
  karigars,
  highlight,
}: {
  karigars: KarigarListRow[];
  highlight?: string;
}) {
  return (
    <>
      {/* Phone */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {karigars.map((k) => (
          <li key={k.id}>
            <Link
              href={`/karigars/${k.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                highlight === k.id ? "border-brand ring-1 ring-brand" : "border-border"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{k.name}</span>
                  {k.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                </div>
                {k.contact1 ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{k.contact1}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{k.partyCount}</span>{" "}
                  {k.partyCount === 1 ? "party" : "parties"} ·{" "}
                  <span className="tabular-nums">{k.jobWorkCount}</span>{" "}
                  {k.jobWorkCount === 1 ? "job work" : "job works"}
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
              <th className="h-11 px-4 font-medium text-muted-foreground">Karigar</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Contact</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Parties</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Job works</th>
              <th className="h-11 w-10 px-4" />
            </tr>
          </thead>
          <tbody>
            {karigars.map((k) => (
              <tr
                key={k.id}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                  highlight === k.id && "bg-accent/60"
                )}
              >
                <td className="h-12 px-4">
                  <Link
                    href={`/karigars/${k.id}`}
                    className="flex items-center gap-2 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {k.name}
                    {k.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                  </Link>
                </td>
                <td className="px-4 text-muted-foreground">{k.contact1 ?? "—"}</td>
                <td className="px-4 text-right font-mono tabular-nums text-muted-foreground">
                  {k.partyCount}
                </td>
                <td className="px-4 text-right font-mono tabular-nums text-muted-foreground">
                  {k.jobWorkCount}
                </td>
                <td className="px-4 text-right">
                  <Link
                    href={`/karigars/${k.id}`}
                    aria-label={`Open ${k.name}`}
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

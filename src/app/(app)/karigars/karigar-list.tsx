import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { KarigarListRow } from "@/lib/db/repositories/karigars";
import { RowActions } from "@/components/row-actions";
import {
  archiveKarigarRowAction,
  unarchiveKarigarRowAction,
  deleteKarigarRowAction,
} from "./actions";

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
          <li
            key={k.id}
            className={cn(
              "flex items-center gap-1 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover",
              highlight === k.id ? "border-brand ring-1 ring-brand" : "border-border"
            )}
          >
            <Link
              href={`/karigars/${k.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            </Link>
            <RowActions
              name={k.name}
              noun="karigar"
              isArchived={k.isArchived}
              canDelete={k.jobWorkCount === 0}
              onArchive={archiveKarigarRowAction.bind(null, k.id)}
              onUnarchive={unarchiveKarigarRowAction.bind(null, k.id)}
              onDelete={deleteKarigarRowAction.bind(null, k.id)}
            />
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
              <th className="h-11 w-24 px-4 text-right font-medium text-muted-foreground">Actions</th>
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
                <td className="px-4">
                  <div className="flex justify-end">
                    <RowActions
                      name={k.name}
                      noun="karigar"
                      isArchived={k.isArchived}
                      canDelete={k.jobWorkCount === 0}
                      onArchive={archiveKarigarRowAction.bind(null, k.id)}
                      onUnarchive={unarchiveKarigarRowAction.bind(null, k.id)}
                      onDelete={deleteKarigarRowAction.bind(null, k.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

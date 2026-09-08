import { RecordTrigger } from "@/components/record-trigger";
import { EntityAvatar } from "@/components/entity-avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PartyListRow } from "@/lib/db/repositories/parties";
import { RowActions } from "@/components/row-actions";
import {
  archivePartyRowAction,
  unarchivePartyRowAction,
  deletePartyRowAction,
} from "./actions";

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
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-1 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover",
              highlight === p.id ? "border-brand ring-1 ring-brand" : "border-border"
            )}
          >
            <RecordTrigger
              kind="party"
              id={p.id}
              ariaLabel={`Edit ${p.name}`}
              className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <EntityAvatar name={p.name} imageId={p.logoImageId} size="md" />
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
            </RecordTrigger>
            <RowActions
              name={p.name}
              noun="party"
              isArchived={p.isArchived}
              canDelete={p.jobWorkCount === 0}
              onArchive={archivePartyRowAction.bind(null, p.id)}
              onUnarchive={unarchivePartyRowAction.bind(null, p.id)}
              onDelete={deletePartyRowAction.bind(null, p.id)}
            />
          </li>
        ))}
      </ul>

      {/* Laptop */}
      <div className="hidden rounded-lg border border-border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-border bg-muted text-left shadow-[0_1px_0_var(--border)]">
              <th className="h-11 px-4 font-medium text-muted-foreground">Party</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Owner</th>
              <th className="h-11 px-4 font-medium text-muted-foreground">Contact</th>
              <th className="h-11 px-4 text-right font-medium text-muted-foreground">Job works</th>
              <th className="h-11 w-24 px-4 text-right font-medium text-muted-foreground">Actions</th>
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
                  <RecordTrigger
                    kind="party"
                    id={p.id}
                    ariaLabel={`Edit ${p.name}`}
                    className="flex items-center gap-2.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <EntityAvatar name={p.name} imageId={p.logoImageId} size="sm" />
                    <span className="hover:underline">{p.name}</span>
                    {p.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                  </RecordTrigger>
                </td>
                <td className="px-4 text-muted-foreground">{p.ownerName1}</td>
                <td className="px-4 text-muted-foreground">{p.contact1 ?? "—"}</td>
                <td className="px-4 text-right font-mono tabular-nums text-muted-foreground">
                  {p.jobWorkCount}
                </td>
                <td className="px-4">
                  <div className="flex justify-end">
                    <RowActions
                      name={p.name}
                      noun="party"
                      isArchived={p.isArchived}
                      canDelete={p.jobWorkCount === 0}
                      onArchive={archivePartyRowAction.bind(null, p.id)}
                      onUnarchive={unarchivePartyRowAction.bind(null, p.id)}
                      onDelete={deletePartyRowAction.bind(null, p.id)}
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

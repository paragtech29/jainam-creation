import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SwitchLink } from "@/components/ui/switch-link";
import { cn } from "@/lib/utils";

type PartyRow = {
  id: string;
  name: string;
  ownerName1: string;
  isArchived: boolean;
  jobWorkCount: number;
};

export function PartyList({
  parties,
  showArchived,
  highlight,
  hasAnyParties,
}: {
  parties: PartyRow[];
  showArchived: boolean;
  highlight?: string;
  hasAnyParties: boolean;
}) {
  const toggleHref = showArchived ? "/masters/parties" : "/masters/parties?archived=1";

  return (
    <div className="mt-4">
      <div className="flex justify-end">
        <SwitchLink href={toggleHref} checked={showArchived} label="Show archived" />
      </div>

      {parties.length === 0 ? (
        hasAnyParties ? (
          <NoActivePartiesNotice />
        ) : (
          <EmptyState
            message="No parties yet. Add your first party to get started."
            showAddButton
          />
        )
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {parties.map((party) => (
            <li key={party.id}>
              <Link
                href={`/masters/parties/${party.id}`}
                className={cn(
                  "block min-h-11 rounded-lg border border-border bg-card px-4 py-3 transition-colors",
                  party.isArchived && "opacity-60",
                  highlight === party.id && "ring-2 ring-primary bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{party.name}</span>
                  {party.isArchived && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Archived
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{party.ownerName1}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({
  message,
  showAddButton,
}: {
  message: string;
  showAddButton?: boolean;
}) {
  return (
    <Card className="mt-3 items-center py-8 text-center">
      <CardHeader className="items-center">
        <CardTitle className="font-normal text-muted-foreground">{message}</CardTitle>
        {showAddButton && (
          <Button asChild className="mt-3 h-11">
            <Link href="/masters/parties/new">Add party</Link>
          </Button>
        )}
      </CardHeader>
    </Card>
  );
}

function NoActivePartiesNotice() {
  return (
    <Card className="mt-3 items-center py-8 text-center">
      <CardHeader className="items-center">
        <CardTitle className="font-normal text-muted-foreground">
          All your parties are archived.
        </CardTitle>
        <CardDescription>Use the &quot;Show archived&quot; toggle above to see them.</CardDescription>
      </CardHeader>
    </Card>
  );
}

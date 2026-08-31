import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SwitchLink } from "@/components/ui/switch-link";

type KarigarRow = {
  id: string;
  name: string;
  contact1: string | null;
  isArchived: boolean;
  jobWorkCount: number;
};

export function KarigarList({
  rows,
  showArchived,
  highlight,
  hasAnyAtAll,
}: {
  rows: KarigarRow[];
  showArchived: boolean;
  highlight?: string;
  hasAnyAtAll: boolean;
}) {
  const href = showArchived ? "/masters/karigars" : "/masters/karigars?archived=1";

  if (rows.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex w-full justify-end">
          <SwitchLink href={href} checked={showArchived} label="Show archived" />
        </div>
        <Card className="w-full items-center p-6 text-center">
          {hasAnyAtAll ? (
            <p className="text-sm text-muted-foreground">
              All your karigars are archived. Use &quot;Show archived&quot; above to see them.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No karigars yet. Add your first silai karigar to get started.
              </p>
              <Button asChild className="mt-3 h-11">
                <Link href="/masters/karigars/new">Add karigar</Link>
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex justify-end">
        <SwitchLink href={href} checked={showArchived} label="Show archived" />
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((k) => (
          <Link
            key={k.id}
            href={`/masters/karigars/${k.id}`}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10",
              k.isArchived && "opacity-60",
              highlight === k.id && "ring-2 ring-primary bg-primary/5"
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{k.name}</span>
              {k.contact1 ? (
                <span className="text-sm text-muted-foreground tnum">{k.contact1}</span>
              ) : null}
            </div>
            {k.isArchived ? (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Archived
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

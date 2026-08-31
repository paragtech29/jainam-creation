"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SwitchLink } from "@/components/ui/switch-link";
import { cn } from "@/lib/utils";
import { InlineParticularForm } from "./inline-particular-form";

type ParticularRow = {
  id: string;
  name: string;
  defaultPrice: number;
  isArchived: boolean;
  usageCount: number;
};

export function ParticularList({
  particulars,
  showArchived,
  highlight,
}: {
  particulars: ParticularRow[];
  showArchived: boolean;
  highlight?: string;
}) {
  const router = useRouter();
  const [showInline, setShowInline] = useState(false);
  const [justAdded, setJustAdded] = useState<{ name: string; defaultPrice: number } | null>(null);

  const hasAny = particulars.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setShowInline((v) => !v);
            setJustAdded(null);
          }}
          className="min-h-11 text-left text-sm font-medium text-primary"
        >
          + Add particular here
        </button>
        <SwitchLink
          href={showArchived ? "/masters/particulars" : "/masters/particulars?archived=1"}
          checked={showArchived}
          label="Show archived"
        />
      </div>

      {showInline ? (
        <InlineParticularForm
          autoFocus
          onCreated={(p) => {
            setShowInline(false);
            setJustAdded(p);
            router.refresh();
          }}
          onCancel={() => setShowInline(false)}
        />
      ) : null}

      {justAdded ? (
        <p role="status" className="text-sm text-success">
          Added {justAdded.name} — ₹{justAdded.defaultPrice}
        </p>
      ) : null}

      {!hasAny && !showArchived ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No particulars yet. Add your first particular (like galu or patti) to get started.
            </p>
            <Button asChild className="h-11 text-base">
              <Link href="/masters/particulars/new">Add particular</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!hasAny && showArchived ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">All your particulars are archived.</p>
            <p className="text-xs text-muted-foreground">
              Use the &quot;Show archived&quot; toggle to switch back.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hasAny ? (
        <ul className="flex flex-col gap-2">
          {particulars.map((p) => (
            <li key={p.id}>
              <Link
                href={`/masters/particulars/${p.id}`}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
                  p.isArchived && "opacity-60",
                  highlight === p.id && "ring-2 ring-primary bg-primary/5"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.isArchived ? (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Archived
                    </span>
                  ) : null}
                </span>
                <span className="tnum text-base">₹{p.defaultPrice}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

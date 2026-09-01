"use client";

// Phase-3-shaped single-link control, proven here on a real screen. Phase 3
// mounts this same shape inside a bottom-sheet above a half-filled job work
// form when the selected party has no karigars linked yet, so this
// component must NEVER navigate — no router.push, no <Link>, no redirect.
// Any navigation would destroy exactly what the inline flow exists to
// protect. router.refresh() only.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkSingleKarigarAction } from "../actions";
import { Button } from "@/components/ui/button";

export function InlineLinkKarigar({
  partyId,
  candidates,
}: {
  partyId: string;
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (candidates.length === 0) return null;

  function handleAdd() {
    if (!selectedId) return;
    setError(null);
    setLinkedName(null);
    startTransition(async () => {
      const result = await linkSingleKarigarAction(partyId, selectedId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const karigar = candidates.find((k) => k.id === selectedId);
      setLinkedName(karigar?.name ?? null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-primary hover:underline"
      >
        + Link a karigar
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-base"
        >
          {candidates.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <Button type="button" onClick={handleAdd} disabled={isPending}>
          {isPending ? "Adding..." : "Add"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {linkedName && (
        <p className="text-sm text-muted-foreground">
          Linked {linkedName} to this party.
        </p>
      )}
    </div>
  );
}

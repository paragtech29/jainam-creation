import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import {
  getKarigarById,
  countKarigarJobWorks,
  listPartyIdsForKarigar,
} from "@/lib/db/repositories/karigars";
import { listParties } from "@/lib/db/repositories/parties";
import { Badge } from "@/components/ui/badge";
import { KarigarForm } from "../karigar-form";
import { KarigarRecordActions } from "./karigar-record-actions";

export default async function KarigarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const karigar = await getKarigarById(userId, id);
  if (!karigar) notFound();

  const [jobWorkCount, linkedPartyIds, allParties] = await Promise.all([
    countKarigarJobWorks(userId, id),
    listPartyIdsForKarigar(userId, id),
    listParties(userId),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/karigars"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to karigars
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{karigar.name}</h1>
          {karigar.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="tabular-nums">{jobWorkCount}</span>{" "}
          {jobWorkCount === 1 ? "job work" : "job works"} recorded
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <KarigarForm
          karigar={karigar}
          parties={allParties.map((p) => ({ id: p.id, name: p.name }))}
          linkedPartyIds={linkedPartyIds}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <KarigarRecordActions
          karigarId={id}
          isArchived={karigar.isArchived}
          canDelete={jobWorkCount === 0}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getPartyWithKarigars, countPartyJobWorks } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
import { Badge } from "@/components/ui/badge";
import { PartyForm } from "../party-form";
import { PartyRecordActions } from "./party-record-actions";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const party = await getPartyWithKarigars(userId, id);
  if (!party) notFound();

  const [jobWorkCount, allKarigars] = await Promise.all([
    countPartyJobWorks(userId, id),
    listKarigars(userId),
  ]);
  const linked = allKarigars.filter((k) => party.karigarIds.includes(k.id));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/parties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to parties
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{party.name}</h1>
          {party.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="tabular-nums">{jobWorkCount}</span>{" "}
          {jobWorkCount === 1 ? "job work" : "job works"} recorded
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <PartyForm party={party} />
      </div>

      {/* Read-only here by design. Linking is managed on the karigar, so there
          is exactly one place to change it and no chance of two screens
          disagreeing about who works for whom. */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="font-heading text-base font-semibold">Silai karigars</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These karigars will be offered when you record a job work for {party.name}.
        </p>

        {linked.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {linked.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/karigars/${k.id}`}
                  className="flex min-h-11 items-center gap-2.5 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Scissors size={15} className="text-brand" aria-hidden="true" />
                  {k.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No karigars linked yet.
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          To change this, open the karigar and edit the parties they work for.{" "}
          <Link href="/karigars" className="font-medium text-brand underline underline-offset-4">
            Go to Silai Karigar
          </Link>
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <PartyRecordActions
          partyId={id}
          isArchived={party.isArchived}
          canDelete={jobWorkCount === 0}
        />
      </div>
    </div>
  );
}

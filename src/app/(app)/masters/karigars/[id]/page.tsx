import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import {
  getKarigarById,
  countKarigarJobWorks,
  listPartyIdsForKarigar,
} from "@/lib/db/repositories/karigars";
import { listParties } from "@/lib/db/repositories/parties";
import { Separator } from "@/components/ui/separator";
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

  const linkedPartyNames = allParties
    .filter((p) => linkedPartyIds.includes(p.id))
    .map((p) => p.name);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/masters/karigars" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to karigars
      </Link>
      <h1 className="mt-2 font-heading text-xl font-medium text-foreground">{karigar.name}</h1>

      <div className="mt-6">
        <KarigarForm karigar={karigar} />
      </div>

      <Separator className="my-6" />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Works for</h2>
        {linkedPartyNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {linkedPartyNames.map((name) => (
              <span
                key={name}
                className="rounded bg-muted px-2 py-1 text-sm text-muted-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to any party yet.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Linked parties are managed from each party&apos;s own screen.{" "}
          <Link href="/masters/parties" className="underline underline-offset-4">
            Go to parties
          </Link>
        </p>
      </div>

      <Separator className="my-6" />

      <KarigarRecordActions
        karigarId={id}
        isArchived={karigar.isArchived}
        canDelete={jobWorkCount === 0}
      />
    </div>
  );
}

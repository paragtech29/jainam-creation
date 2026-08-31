import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getPartyById, countPartyJobWorks } from "@/lib/db/repositories/parties";
import { Separator } from "@/components/ui/separator";
import { PartyForm } from "../party-form";
import { PartyRecordActions } from "./party-record-actions";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const party = await getPartyById(userId, id);
  if (!party) notFound();

  const jobWorkCount = await countPartyJobWorks(userId, id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/masters/parties" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to parties
      </Link>
      <h1 className="mt-2 font-heading text-xl font-medium text-foreground">{party.name}</h1>

      <div className="mt-6">
        <PartyForm party={party} />
      </div>

      {/* Linked karigars section — added in 02-06 */}

      <Separator className="my-6" />

      <PartyRecordActions
        partyId={id}
        isArchived={party.isArchived}
        canDelete={jobWorkCount === 0}
      />
    </div>
  );
}

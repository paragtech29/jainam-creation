import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getPartyWithKarigars, countPartyJobWorks } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
import { Separator } from "@/components/ui/separator";
import { PartyForm } from "../party-form";
import { PartyRecordActions } from "./party-record-actions";
import { KarigarLinkForm } from "./karigar-link-form";
import { InlineLinkKarigar } from "./inline-link-karigar";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const party = await getPartyWithKarigars(userId, id);
  if (!party) notFound();

  const jobWorkCount = await countPartyJobWorks(userId, id);
  // Active-only by design, so archived karigars are never offered as new links.
  const allKarigars = await listKarigars(userId);
  const candidates = allKarigars.filter((k) => !party.karigarIds.includes(k.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/masters/parties" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to parties
      </Link>
      <h1 className="mt-2 font-heading text-xl font-medium text-foreground">{party.name}</h1>

      <div className="mt-6">
        <PartyForm party={party} />
      </div>

      <Separator className="my-6" />

      <div className="flex flex-col gap-4">
        <KarigarLinkForm partyId={id} karigars={allKarigars} linkedIds={party.karigarIds} />
        <InlineLinkKarigar partyId={id} candidates={candidates} />
      </div>

      <Separator className="my-6" />

      <PartyRecordActions
        partyId={id}
        isArchived={party.isArchived}
        canDelete={jobWorkCount === 0}
      />
    </div>
  );
}

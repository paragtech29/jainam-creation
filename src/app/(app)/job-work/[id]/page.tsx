import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getJobWorkWithDescriptions } from "@/lib/db/repositories/jobWorks";
import { listParties, getPartyById } from "@/lib/db/repositories/parties";
import { listKarigars, listKarigarPartyLinks, getKarigarById } from "@/lib/db/repositories/karigars";
import { listDescriptionTypes } from "@/lib/db/repositories/description-types";
import { JobWorkForm } from "../job-work-form";
import { JobWorkRecordActions } from "./job-work-record-actions";

export default async function JobWorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const jobWork = await getJobWorkWithDescriptions(userId, id);
  // getJobWorkWithDescriptions filters on userId internally, so another
  // user's id resolves to null and lands here rather than leaking a record.
  if (!jobWork) notFound();

  const [allParties, allKarigars, karigarPartyLinks, allDescriptionTypes, ownKarigar] =
    await Promise.all([
      listParties(userId),
      listKarigars(userId),
      listKarigarPartyLinks(userId),
      listDescriptionTypes(userId),
      getKarigarById(userId, jobWork.karigarId),
    ]);

  // THE ARCHIVED-ENTITY TRAP: listParties/listKarigars/listDescriptionTypes
  // all exclude archived rows, which is correct for a NEW job work but wrong
  // here — if this job work's party, karigar or a description type it uses
  // was archived AFTER this record was saved, the plain "active only" list
  // would silently drop it from the dropdown and re-saving the form would
  // blank a required field. So we union in whatever this job work actually
  // references, even if archived, on top of the active list.
  const parties = allParties.some((p) => p.id === jobWork.partyId)
    ? allParties
    : await getPartyById(userId, jobWork.partyId).then((p) => (p ? [...allParties, p] : allParties));

  const karigarIsArchivedOnly = !allKarigars.some((k) => k.id === jobWork.karigarId);
  const karigars = karigarIsArchivedOnly && ownKarigar ? [...allKarigars, ownKarigar] : allKarigars;

  // listKarigarPartyLinks excludes archived karigars from its join, so an
  // archived karigar unioned in above would otherwise have NO link to this
  // party, sending the form's dropdown into its "no karigars linked" branch
  // instead of showing the archived karigar as selected. Synthesize the
  // pairing so the form can filter it in — this does not write anything to
  // the database, it only affects what this render shows.
  const jobWorkKarigarPartyLinks =
    karigarIsArchivedOnly && ownKarigar
      ? [...karigarPartyLinks, { karigarId: jobWork.karigarId, partyId: jobWork.partyId }]
      : karigarPartyLinks;

  const descriptionTypes: { id: string; name: string }[] = allDescriptionTypes.map((dt) => ({
    id: dt.id,
    name: dt.name,
  }));
  for (const line of jobWork.lines) {
    if (!descriptionTypes.some((dt) => dt.id === line.descriptionTypeId)) {
      descriptionTypes.push({ id: line.descriptionTypeId, name: line.descriptionTypeName });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/job-work"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to job work
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">Edit job work</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <JobWorkForm
          jobWork={{
            id: jobWork.id,
            date: jobWork.date,
            partyId: jobWork.partyId,
            karigarId: jobWork.karigarId,
            chalanNo: jobWork.chalanNo,
            partyDesignNo: jobWork.partyDesignNo,
            computerDesignNo: jobWork.computerDesignNo,
            pieces: jobWork.pieces,
            rate: jobWork.rate,
            comment: jobWork.comment,
            status: jobWork.status,
            isBilled: jobWork.isBilled,
            lines: jobWork.lines.map((l) => ({
              descriptionTypeId: l.descriptionTypeId,
              priceUsed: l.priceUsed,
            })),
          }}
          parties={parties.map((p) => ({ id: p.id, name: p.name }))}
          karigars={karigars.map((k) => ({ id: k.id, name: k.name }))}
          karigarPartyLinks={jobWorkKarigarPartyLinks}
          descriptionTypes={descriptionTypes}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <JobWorkRecordActions jobWorkId={jobWork.id} />
      </div>
    </div>
  );
}

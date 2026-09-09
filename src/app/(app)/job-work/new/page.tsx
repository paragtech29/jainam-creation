import { Users, Scissors } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars, listKarigarPartyLinks } from "@/lib/db/repositories/karigars";
import { listDescriptionTypes } from "@/lib/db/repositories/description-types";
import { EmptyState } from "@/components/empty-state";
import { JobWorkForm } from "../job-work-form";

export default async function NewJobWorkPage() {
  const userId = await getCurrentUserId();

  const [allParties, karigars, karigarPartyLinks, descriptionTypes] = await Promise.all([
    listParties(userId),
    listKarigars(userId),
    listKarigarPartyLinks(userId),
    listDescriptionTypes(userId),
  ]);

  // listParties/listKarigars already exclude archived rows, but be explicit
  // about the party filter here too — an archived party must never be
  // offered on a brand-new job work.
  const parties = allParties.filter((p) => !p.isArchived);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-5">

      {parties.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add a party first"
          description="A job work always belongs to a party. Add one before recording work."
          actionLabel="Add a party"
          actionHref="/parties/new"
        />
      ) : karigars.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Add a silai karigar first"
          description="A job work always has a silai karigar. Add one before recording work."
          actionLabel="Add a karigar"
          actionHref="/karigars/new"
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <JobWorkForm
            parties={parties.map((p) => ({ id: p.id, name: p.name }))}
            karigars={karigars.map((k) => ({ id: k.id, name: k.name }))}
            karigarPartyLinks={karigarPartyLinks}
            descriptionTypes={descriptionTypes.map((dt) => ({ id: dt.id, name: dt.name }))}
          />
        </div>
      )}
    </div>
  );
}

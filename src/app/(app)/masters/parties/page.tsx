import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listPartiesWithJobWorkCounts } from "@/lib/db/repositories/parties";
import { Button } from "@/components/ui/button";
import { PartyList } from "./party-list";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; highlight?: string }>;
}) {
  const { archived, highlight } = await searchParams;
  const showArchived = archived === "1";

  const userId = await getCurrentUserId();
  const parties = await listPartiesWithJobWorkCounts(userId, showArchived);
  // Needed to tell "no parties at all" apart from "parties exist but are
  // all archived and hidden by the current filter" when the visible list
  // is empty.
  const hasAnyParties =
    parties.length > 0 || (await listPartiesWithJobWorkCounts(userId, true)).length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-xl font-medium text-foreground">Parties</h1>
        <Button asChild size="lg" className="h-11">
          <Link href="/masters/parties/new">Add party</Link>
        </Button>
      </div>

      <PartyList
        parties={parties}
        showArchived={showArchived}
        highlight={highlight}
        hasAnyParties={hasAnyParties}
      />
    </div>
  );
}

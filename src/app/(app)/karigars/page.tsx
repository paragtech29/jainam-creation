import { Scissors } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listKarigarsPage } from "@/lib/db/repositories/karigars";
import { SearchInput } from "@/components/search-input";
import { ArchivedFilter } from "@/components/status-filter";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { KarigarList } from "./karigar-list";
import { KarigarDialogs } from "./karigar-dialogs";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigarPartyLinks } from "@/lib/db/repositories/karigars";

const PAGE_SIZE = 10;

export default async function KarigarsPage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
    highlight?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
    const archivedMode = sp.archived ?? "active";
  const includeArchived = archivedMode !== "active";
  const archivedOnly = archivedMode === "archived";
  const search = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const userId = await getCurrentUserId();

  // The dialogs are client-side now, so their data has to be here up front:
  // the party list for the "works for" checklist, and the links grouped by
  // karigar. One query each, not one per row.
  const [allParties, allLinks] = await Promise.all([
    listParties(userId),
    listKarigarPartyLinks(userId),
  ]);
  const linksByKarigar: Record<string, string[]> = {};
  for (const l of allLinks) {
    (linksByKarigar[l.karigarId] ??= []).push(l.partyId);
  }
  const { rows, total } = await listKarigarsPage(userId, {
    search,
    includeArchived,
    archivedOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtering = Boolean(search) || archivedMode !== "active";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Client-state dialogs — see record-dialog-store.ts. */}
      <KarigarDialogs
        rows={rows}
        parties={allParties.map((p) => ({ id: p.id, name: p.name }))}
        linksByKarigar={linksByKarigar}
      />


      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search karigar name or contact" />
        <ArchivedFilter />
      </div>

      {/* The shell is overflow-hidden, so anything taller than the body is
          clipped rather than scrolled. This scroller wraps the whole content
          area — list OR empty state — so nothing is ever unreachable on a
          short screen. The pager stays outside it, pinned to the bottom. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {rows.length === 0 ? (
          filtering ? (
            <EmptyState
            icon={Scissors}
            title="No karigars match"
            description={
              search
                ? `Nothing found for "${search}". Try a shorter search, or clear it to see everyone.`
                : "Nothing to show for this filter."
            }
            fill
            variant="search"
          />
        ) : (
          <EmptyState
            icon={Scissors}
            title="No karigars yet"
            description="Add the silai karigars you work with, and tick which parties each one works for."
            hint="Use the Add karigar button at the top right to add your first one."
            steps={[
              "Add the karigar — the person you collect the maal from.",
              "Link the parties they sew for, so the right names appear together.",
              "Pick them when you record a job work for one of those parties.",
            ]}
            fill
          />
          )
        ) : (
          <KarigarList karigars={rows} highlight={sp.highlight} />
        )}
      </div>

      {rows.length > 0 ? (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          baseParams={{ q: search, archived: archivedMode === "active" ? undefined : archivedMode }}
        />
      ) : null}
    </div>
  );
}

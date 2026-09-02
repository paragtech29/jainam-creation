import { Scissors } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listKarigarsPage } from "@/lib/db/repositories/karigars";
import { SearchInput } from "@/components/search-input";
import { ArchivedFilter } from "@/components/status-filter";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { KarigarList } from "./karigar-list";
import { RecordDialog } from "@/components/record-dialog";
import { KarigarForm } from "./karigar-form";
import { listParties } from "@/lib/db/repositories/parties";

const PAGE_SIZE = 20;

export default async function KarigarsPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
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
  const allParties = sp.new === "1" ? await listParties(userId) : [];
  const { rows, total } = await listKarigarsPage(userId, {
    search,
    includeArchived,
    archivedOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtering = Boolean(search) || archivedMode !== "active";

  return (
    <div className="space-y-5">
      {sp.new === "1" ? (
        <RecordDialog
          title="Add karigar"
          description="Only the name is required. You can fill in the rest later."
        >
          <KarigarForm parties={allParties.map((p) => ({ id: p.id, name: p.name }))} />
        </RecordDialog>
      ) : null}


      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search karigar name or contact" />
        <ArchivedFilter />
      </div>

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
          />
        ) : (
          <EmptyState
            icon={Scissors}
            title="No karigars yet"
            description="Add the silai karigars you work with, and tick which parties each one works for."
            actionLabel="Add your first karigar"
            actionHref="/karigars?new=1"
          />
        )
      ) : (
        <>
          <KarigarList karigars={rows} highlight={sp.highlight} />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseParams={{ q: search, archived: archivedMode === "active" ? undefined : archivedMode }}
          />
        </>
      )}
    </div>
  );
}

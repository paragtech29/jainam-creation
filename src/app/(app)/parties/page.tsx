import { Building2 } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listPartiesPage } from "@/lib/db/repositories/parties";
import { SearchInput } from "@/components/search-input";
import { ArchivedFilter } from "@/components/status-filter";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { PartyList } from "./party-list";
import { RecordDialog } from "@/components/record-dialog";
import { PartyForm } from "./party-form";

const PAGE_SIZE = 20;

export default async function PartiesPage({
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
  const { rows, total } = await listPartiesPage(userId, {
    search,
    includeArchived,
    archivedOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtering = Boolean(search) || archivedMode !== "active";

  return (
    <div className="flex flex-1 flex-col gap-5">
      {sp.new === "1" ? (
        <RecordDialog
          title="Add party"
          description="Party name, owner name, contact number and gender are required."
        >
          <PartyForm />
        </RecordDialog>
      ) : null}


      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search party or owner name" />
        <ArchivedFilter />
      </div>

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={Building2}
            title="No parties match"
            description={
              search
                ? `Nothing found for "${search}". Try a shorter search, or clear it to see everyone.`
                : "Nothing to show for this filter."
            }
            fill
            variant="search"
            actionLabel="Clear search and filters"
            actionHref="/parties"
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="No parties yet"
            description="Add the businesses who give you work. You'll pick one every time you record a job work."
            hint="Use the Add party button at the top right to add your first one."
            steps={[
              "Add the party — the business that gives you the maal.",
              "Link the silai karigars you collect their maal from.",
              "Record a job work against them, and the totals add up here.",
            ]}
            fill
          />
        )
      ) : (
        <>
          <PartyList parties={rows} highlight={sp.highlight} />
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

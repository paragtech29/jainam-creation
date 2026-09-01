import { Building2 } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listPartiesPage } from "@/lib/db/repositories/parties";
import { SearchInput } from "@/components/search-input";
import { SwitchLink } from "@/components/ui/switch-link";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { PartyList } from "./party-list";

const PAGE_SIZE = 20;

export default async function PartiesPage({
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
  const showArchived = sp.archived === "1";
  const search = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const userId = await getCurrentUserId();
  const { rows, total } = await listPartiesPage(userId, {
    search,
    includeArchived: showArchived,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtering = Boolean(search) || showArchived;
  const toggleHref = new URLSearchParams();
  if (search) toggleHref.set("q", search);
  if (!showArchived) toggleHref.set("archived", "1");

  return (
    <div className="space-y-5">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search party or owner name" />
        <SwitchLink
          href={`/parties?${toggleHref.toString()}`}
          checked={showArchived}
          label="Show archived"
        />
      </div>

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={Building2}
            title="No parties match"
            description={
              search
                ? `Nothing found for "${search}". Try a shorter search, or clear it to see everyone.`
                : "There are no archived parties."
            }
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="No parties yet"
            description="Add the businesses who give you work. You'll pick one every time you record a job work."
            actionLabel="Add your first party"
            actionHref="/parties/new"
          />
        )
      ) : (
        <>
          <PartyList parties={rows} highlight={sp.highlight} />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseParams={{ q: search, archived: showArchived ? "1" : undefined }}
          />
        </>
      )}
    </div>
  );
}

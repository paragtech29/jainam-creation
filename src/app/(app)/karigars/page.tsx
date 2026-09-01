import { Scissors } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listKarigarsPage } from "@/lib/db/repositories/karigars";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SwitchLink } from "@/components/ui/switch-link";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { KarigarList } from "./karigar-list";

const PAGE_SIZE = 20;

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
  const showArchived = sp.archived === "1";
  const search = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const userId = await getCurrentUserId();
  const { rows, total } = await listKarigarsPage(userId, {
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
      <PageHeader
        title="Silai Karigar"
        description="The karigars you collect maal from."
        actionLabel="Add karigar"
        actionHref="/karigars/new"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search karigar name or contact" />
        <SwitchLink
          href={`/karigars?${toggleHref.toString()}`}
          checked={showArchived}
          label="Show archived"
        />
      </div>

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={Scissors}
            title="No karigars match"
            description={
              search
                ? `Nothing found for "${search}". Try a shorter search, or clear it to see everyone.`
                : "There are no archived karigars."
            }
          />
        ) : (
          <EmptyState
            icon={Scissors}
            title="No karigars yet"
            description="Add the silai karigars you work with, and tick which parties each one works for."
            actionLabel="Add your first karigar"
            actionHref="/karigars/new"
          />
        )
      ) : (
        <>
          <KarigarList karigars={rows} highlight={sp.highlight} />
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

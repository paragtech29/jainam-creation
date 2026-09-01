import { ClipboardList } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listJobWorksPage } from "@/lib/db/repositories/jobWorks";
import { SearchInput } from "@/components/search-input";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { JobWorkList } from "./job-work-list";

const PAGE_SIZE = 20;

export default async function JobWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; highlight?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const userId = await getCurrentUserId();
  const { rows, total } = await listJobWorksPage(userId, {
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtering = Boolean(search);

  return (
    <div className="space-y-5">

      <SearchInput placeholder="Search chalan no., design no., party or karigar" />

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={ClipboardList}
            title="No job works match"
            description={`Nothing found for "${search}". Try a shorter search, or clear it to see everything.`}
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No job works yet"
            description="Record your first chalan — date, party, karigar, description rows and pieces."
            actionLabel="Add your first job work"
            actionHref="/job-work/new"
          />
        )
      ) : (
        <>
          <JobWorkList rows={rows} highlight={sp.highlight} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={{ q: search }} />
        </>
      )}
    </div>
  );
}

import { ClipboardList } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listJobWorksPage } from "@/lib/db/repositories/jobWorks";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { JobWorkFilters } from "./job-work-filters";
import { JobWorkList } from "./job-work-list";

const PAGE_SIZE = 10;

export default async function JobWorkPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    highlight?: string;
    from?: string;
    to?: string;
    party?: string;
    karigar?: string;
    status?: string;
    billed?: string;
  }>;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const userId = await getCurrentUserId();
  const [{ rows, total, grandTotal }, parties, karigars] = await Promise.all([
    listJobWorksPage(userId, {
      search,
      from: sp.from,
      to: sp.to,
      partyId: sp.party,
      karigarId: sp.karigar,
      status: sp.status,
      billed: sp.billed === "yes" || sp.billed === "no" ? sp.billed : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listParties(userId),
    listKarigars(userId),
  ]);

  const filtering =
    Boolean(search) || Boolean(sp.from || sp.to || sp.party || sp.karigar || sp.status || sp.billed);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">

      <JobWorkFilters
        parties={parties.map((p) => ({ id: p.id, name: p.name }))}
        karigars={karigars.map((k) => ({ id: k.id, name: k.name }))}
      />

      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={ClipboardList}
            title="No job works match"
            description="Nothing matches these filters. Try clearing one of them."
            fill
            variant="search"
            actionLabel="Clear search and filters"
            actionHref="/job-work"
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No job works yet"
            description="Record your first chalan — date, party, karigar, description rows and pieces."
            hint="Use the Add job work button at the top right to record your first one."
            steps={[
              "Pick the party and the karigar you took the maal from.",
              "Add the description rows — galu, patti, daman — and the pieces.",
              "The rate and total are worked out for you, as in the book.",
            ]}
            fill
          />
        )
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <JobWorkList rows={rows} highlight={sp.highlight} />
          </div>

          {/* Summed in SQL across the whole filtered set, not just this page. */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border bg-card px-[18px] py-3">
            <Pagination
              className="flex-1 border-t-0 pt-0"
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              baseParams={{
                q: search,
                from: sp.from,
                to: sp.to,
                party: sp.party,
                karigar: sp.karigar,
                status: sp.status,
                billed: sp.billed,
              }}
            />
            <span className="border-l border-border pl-4 text-[12.5px] text-secondary-foreground">
              Total this view{" "}
              <strong className="font-mono font-semibold tabular-nums text-foreground">
                ₹{grandTotal.toLocaleString("en-IN")}
              </strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

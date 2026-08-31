import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listKarigarsWithJobWorkCounts } from "@/lib/db/repositories/karigars";
import { Button } from "@/components/ui/button";
import { KarigarList } from "./karigar-list";

export default async function KarigarsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; highlight?: string }>;
}) {
  const { archived, highlight } = await searchParams;
  const userId = await getCurrentUserId();
  const showArchived = archived === "1";

  // Fetch the full set once, then derive the shown rows and whether any
  // archived-only karigars exist, so the two distinct empty states can be
  // told apart without a second query.
  const allRows = await listKarigarsWithJobWorkCounts(userId, true);
  const rows = showArchived ? allRows : allRows.filter((k) => !k.isArchived);
  const hasAnyAtAll = allRows.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-xl font-medium text-foreground">Silai karigars</h1>
        <Button asChild size="lg" className="h-11">
          <Link href="/masters/karigars/new">Add karigar</Link>
        </Button>
      </div>

      <KarigarList
        rows={rows}
        showArchived={showArchived}
        highlight={highlight}
        hasAnyAtAll={hasAnyAtAll}
      />
    </div>
  );
}

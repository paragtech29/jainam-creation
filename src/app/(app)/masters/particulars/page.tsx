import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/session";
import { listParticularsWithUsageCounts } from "@/lib/db/repositories/particulars";
import { ParticularList } from "./particular-list";

export default async function ParticularsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; highlight?: string }>;
}) {
  const { archived, highlight } = await searchParams;
  const showArchived = archived === "1";

  const userId = await getCurrentUserId();
  const particulars = await listParticularsWithUsageCounts(userId, showArchived);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Particulars</h1>
        <Button asChild className="h-11 text-base">
          <Link href="/masters/particulars/new">Add particular</Link>
        </Button>
      </div>
      <ParticularList particulars={particulars} showArchived={showArchived} highlight={highlight} />
    </div>
  );
}

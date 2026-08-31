import { notFound } from "next/navigation";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { getCurrentUserId } from "@/lib/session";
import { getParticularById, countParticularUsages } from "@/lib/db/repositories/particulars";
import { ParticularForm } from "../particular-form";
import { ParticularRecordActions } from "./particular-record-actions";

export default async function ParticularDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const particular = await getParticularById(userId, id);
  if (!particular) notFound();

  const usageCount = await countParticularUsages(userId, id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link href="/masters/particulars" className="text-sm text-muted-foreground">
        ← Back to particulars
      </Link>
      <h1 className="text-lg font-semibold">{particular.name}</h1>
      <ParticularForm particular={particular} />
      <Separator />
      <ParticularRecordActions
        particularId={id}
        isArchived={particular.isArchived}
        canDelete={usageCount === 0}
      />
    </div>
  );
}

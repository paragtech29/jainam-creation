import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { KarigarForm } from "../karigar-form";

export default async function NewKarigarPage() {
  const userId = await getCurrentUserId();
  const parties = await listParties(userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/karigars" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to karigars
      </Link>
      <h1 className="mt-2 font-heading text-xl font-medium text-foreground">Add karigar</h1>

      <div className="mt-6">
        <KarigarForm parties={parties.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
    </div>
  );
}

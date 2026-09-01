import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { KarigarForm } from "../karigar-form";

export default async function NewKarigarPage() {
  const userId = await getCurrentUserId();
  const parties = await listParties(userId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/karigars"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to karigars
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">Add karigar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the name is required. You can fill in the rest later.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <KarigarForm parties={parties.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
    </div>
  );
}

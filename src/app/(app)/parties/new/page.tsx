import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PartyForm } from "../party-form";

export default function NewPartyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/parties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to parties
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">Add party</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the party name and first owner name are required.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <PartyForm />
      </div>
    </div>
  );
}

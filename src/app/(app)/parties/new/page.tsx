import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PartyForm } from "../party-form";

export default function NewPartyPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/parties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to parties
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <PartyForm />
      </div>
    </div>
  );
}

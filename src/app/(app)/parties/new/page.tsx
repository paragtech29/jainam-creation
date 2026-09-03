import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PartyForm } from "../party-form";

export default function NewPartyPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-5">
      <div>
        <Link
          href="/parties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to parties
        </Link>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
        <PartyForm />
      </div>
    </div>
  );
}

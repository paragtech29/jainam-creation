import Link from "next/link";
import { PartyForm } from "../party-form";

export default function NewPartyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/masters/parties" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to parties
      </Link>
      <h1 className="mt-2 font-heading text-xl font-medium text-foreground">Add party</h1>
      <div className="mt-6">
        <PartyForm />
      </div>
    </div>
  );
}

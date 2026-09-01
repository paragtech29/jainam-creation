import { ClipboardList } from "lucide-react";

export default function JobWorkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Job Work</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every chalan you take from a party, with its description, pieces and total.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent">
          <ClipboardList size={22} className="text-brand" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-heading text-base font-semibold">Coming next</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          The job work form is the next thing being built — date, party, silai
          karigar, description rows, pieces and an automatic total.
        </p>
      </div>
    </div>
  );
}

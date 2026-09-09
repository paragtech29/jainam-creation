"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { SimpleSelect } from "@/components/ui/simple-select";
import { cn } from "@/lib/utils";
import { setJobWorkProgressAction, type JobWorkProgress } from "./actions";

/**
 * Status and bill status, changeable from the list.
 *
 * The owner asked for this because the common case is a row whose work has
 * moved on — opening the whole form to change one dropdown is four clicks for
 * a one-word change.
 *
 * Two dropdowns rather than a dropdown and a switch: he offered either and
 * said whichever is easier, and two selects behave identically on a phone,
 * where a 20px switch inside a table row is a poor target.
 *
 * The value shown is LOCAL state seeded from the row, so the change appears at
 * once and does not wait for the server round trip. On failure it snaps back
 * to what the server actually holds and shows why — an optimistic control that
 * keeps a value the database rejected is worse than a slow one.
 */
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending", dot: "bg-status-pending" },
  { value: "IN_PROGRESS", label: "In Progress", dot: "bg-status-progress" },
  { value: "COMPLETED", label: "Completed", dot: "bg-status-completed" },
] as const;

export function RowProgress({
  jobWorkId,
  status,
  isBilled,
  partyName,
}: {
  jobWorkId: string;
  status: JobWorkProgress["status"];
  isBilled: boolean;
  partyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<JobWorkProgress>({ status, isBilled });
  const [error, setError] = useState<string | null>(null);

  function apply(next: Partial<JobWorkProgress>) {
    const optimistic = { ...value, ...next };
    // Moving away from Completed cannot stay billed — the server enforces it,
    // and showing it here keeps the two dropdowns honest with each other in
    // the same tick.
    if (optimistic.status !== "COMPLETED") optimistic.isBilled = false;

    setValue(optimistic);
    setError(null);

    startTransition(async () => {
      const res = await setJobWorkProgressAction(jobWorkId, next);
      if ("error" in res) {
        setValue({ status, isBilled });
        setError(res.error);
        return;
      }
      setValue(res.progress);
      // The row's own figures are unchanged, but the list's status filter and
      // the dashboard both read from this.
      router.refresh();
    });
  }

  const completed = value.status === "COMPLETED";

  return (
    <div className="flex flex-col gap-1">
      <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70")}>
        <SimpleSelect
          value={value.status}
          onValueChange={(v) => apply({ status: v as JobWorkProgress["status"] })}
          ariaLabel={`Status for ${partyName}`}
          className="h-9 w-[132px]"
          options={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            dot: o.dot,
          }))}
        />

        {completed ? (
          <SimpleSelect
            value={value.isBilled ? "yes" : "no"}
            onValueChange={(v) => apply({ isBilled: v === "yes" })}
            ariaLabel={`Bill status for ${partyName}`}
            className="h-9 w-[122px]"
            options={[
              { value: "no", label: "Not billed" },
              { value: "yes", label: "Billed", dot: "bg-status-billed" },
            ]}
          />
        ) : (
          // Absent as a CONTROL, present as an explanation: a disabled
          // dropdown invites a click that does nothing and never says why.
          <span
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-muted px-2.5 text-[12.5px] text-muted-foreground"
            title="A job work can only be billed once its status is Completed."
          >
            <Lock size={12} aria-hidden="true" />
            Complete first
          </span>
        )}
      </div>

      {error ? (
        <span role="alert" className="text-[11.5px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

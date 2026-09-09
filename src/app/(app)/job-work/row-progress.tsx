"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
 * They sit in SEPARATE columns, and the bill dropdown is always shown —
 * disabled until the status is Completed — because that is what the owner
 * asked for. It carries a `title` saying why it is disabled: a greyed-out
 * control that refuses a click without explaining is the one thing worse than
 * no control, and the title is what keeps his layout and that concern
 * compatible. `cursor: not-allowed` comes from the global disabled rule.
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
  variant = "cells",
}: {
  jobWorkId: string;
  status: JobWorkProgress["status"];
  isBilled: boolean;
  partyName: string;
  /**
   * "cells" renders two <td>s for the desktop table's two columns; "stacked"
   * renders them side by side for the phone card, where a <td> would be
   * invalid markup.
   */
  variant?: "cells" | "stacked";
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

  const statusSelect = (
    <SimpleSelect
      value={value.status}
      onValueChange={(v) => apply({ status: v as JobWorkProgress["status"] })}
      ariaLabel={`Status for ${partyName}`}
      className="h-9 w-[132px]"
      options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, dot: o.dot }))}
    />
  );

  const billSelect = (
    <span
      // On the wrapper, not the trigger: a disabled control does not fire the
      // events a tooltip or title would need, so the explanation has to live
      // on something that can still be hovered.
      title={
        completed
          ? undefined
          : "A job work can only be billed once its status is Completed."
      }
      className="inline-block"
    >
      <SimpleSelect
        value={value.isBilled ? "yes" : "no"}
        onValueChange={(v) => apply({ isBilled: v === "yes" })}
        ariaLabel={`Bill status for ${partyName}`}
        disabled={!completed}
        className="h-9 w-[122px]"
        options={[
          { value: "no", label: "Not billed" },
          { value: "yes", label: "Billed", dot: "bg-status-billed" },
        ]}
      />
    </span>
  );

  const errorNote = error ? (
    <span role="alert" className="mt-1 block text-[11.5px] text-destructive">
      {error}
    </span>
  ) : null;

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col gap-1", pending && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2">
          {statusSelect}
          {billSelect}
        </div>
        {errorNote}
      </div>
    );
  }

  return (
    <>
      <td className={cn("px-4 py-2", pending && "opacity-70")}>
        {statusSelect}
        {errorNote}
      </td>
      <td className={cn("px-4 py-2", pending && "opacity-70")}>{billSelect}</td>
    </>
  );
}

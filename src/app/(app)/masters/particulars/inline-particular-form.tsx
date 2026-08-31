"use client";

// This is the PART-03 deliverable: a compact, reusable overlay-shaped
// name+price form. Phase 3 mounts this exact component inside a
// bottom-sheet overlay above a half-filled job work form, so the owner
// can invent a new particular mid-job-work without losing his place.
//
// CRITICAL constraint for any future edit here: this component must
// NEVER navigate. No `router.push`, no `<Link>`, no `redirect()`
// anywhere in its render path. Any navigation would destroy exactly
// what PART-03 exists to protect (a half-filled job work form).
//
// This component renders the form CONTENTS ONLY — it does not build
// bottom-sheet/overlay chrome. Its host (the particulars list here in
// Phase 2, the job work form in Phase 3) owns the presentation.
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  createParticularInlineAction,
  type CreateParticularInlineState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 text-base">
      {pending ? "Saving..." : "Add"}
    </Button>
  );
}

export function InlineParticularForm({
  onCreated,
  onCancel,
  autoFocus,
}: {
  onCreated: (p: { id: string; name: string; defaultPrice: number }) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [state, formAction] = useActionState<CreateParticularInlineState, FormData>(
    createParticularInlineAction,
    undefined
  );

  useEffect(() => {
    if (state?.particular) {
      onCreated(state.particular);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.particular]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
    >
      <Field>
        <FieldLabel htmlFor="inline-particular-name">Particular name</FieldLabel>
        <Input
          id="inline-particular-name"
          name="name"
          autoFocus={autoFocus}
          required
          className="h-11 text-base"
        />
        <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="inline-particular-price">Default price (₹)</FieldLabel>
        <Input
          id="inline-particular-price"
          name="defaultPrice"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          required
          className="h-11 text-base tnum"
        />
        <FieldError errors={[{ message: state?.fieldErrors?.defaultPrice }]} />
      </Field>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" variant="outline" onClick={onCancel} className="h-11 text-base">
          Cancel
        </Button>
      </div>
    </form>
  );
}

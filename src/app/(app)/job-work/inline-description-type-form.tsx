"use client";

// PART-03 deliverable: create a missing description type without leaving the
// job work form. Adapted from the deleted
// src/app/(app)/masters/particulars/inline-particular-form.tsx (git 78b215f),
// minus its price field — description types are name-only (PART-01), because
// the same work is charged differently to different parties.
//
// NESTING DECISION: this overlay is rendered inside DescriptionRows, which is
// itself rendered inside the job work form's outer <form>. A second, nested
// <form> is invalid HTML and silently breaks the parent form's submission
// (nested forms are not supported by the DOM; browsers either drop the inner
// form or misattribute submits). To avoid that, this component renders its
// own <form action={formAction}> INSIDE a shadcn Dialog, which is a Radix
// portal — it mounts its content at the end of <body>, outside the job work
// form's DOM subtree entirely, so there is no nesting at all. This also has
// the side benefit of keeping the half-filled job work form fully mounted
// and untouched behind the overlay.
//
// CRITICAL constraint: this component must NEVER navigate. No router.push,
// no router.replace, no router.refresh, no <Link>, no redirect(). Any
// navigation here would destroy exactly what PART-03 exists to protect — a
// half-filled job work form the owner is midway through.
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createDescriptionTypeInlineAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 px-5">
      {pending ? "Adding…" : "Add type"}
    </Button>
  );
}

export function InlineDescriptionTypeForm({
  onCreated,
  onCancel,
}: {
  onCreated: (t: { id: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(createDescriptionTypeInlineAction, undefined);

  useEffect(() => {
    if (state?.descriptionType) {
      onCreated(state.descriptionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.descriptionType]);

  return (
    // Same shell as the Add party / Add karigar dialogs: bordered header,
    // padded body, right-aligned action bar against a tinted footer. It was
    // previously a nested bordered card with left-aligned buttons, which
    // matched nothing else in the app.
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[460px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Add a new type of work
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            It becomes available on every job work from now on.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col">
          <div className="p-5 sm:p-6">
            <Field>
              <FieldLabel htmlFor="inline-description-type-name">Type name</FieldLabel>
              <Input
                id="inline-description-type-name"
                name="name"
                autoFocus
                required
                placeholder="e.g. Galu"
                className="h-[42px]"
              />
              <FieldError errors={[{ message: state?.error }]} />
            </Field>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5 sm:px-6">
            <Button type="button" variant="outline" onClick={onCancel} className="h-10 px-4">
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

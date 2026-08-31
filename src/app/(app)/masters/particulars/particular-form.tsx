"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { getParticularById } from "@/lib/db/repositories/particulars";
import {
  createParticularAction,
  updateParticularAction,
  type ParticularFormState,
} from "./actions";

type Particular = NonNullable<Awaited<ReturnType<typeof getParticularById>>>;

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full text-base">
      {pending ? "Saving..." : isEdit ? "Save changes" : "Add particular"}
    </Button>
  );
}

export function ParticularForm({ particular }: { particular?: Particular }) {
  const router = useRouter();
  const isEdit = !!particular;
  const action = isEdit
    ? updateParticularAction.bind(null, particular.id)
    : createParticularAction;

  const [state, formAction] = useActionState<ParticularFormState, FormData>(
    action,
    undefined
  );

  useEffect(() => {
    if (state?.success && state.newId) {
      router.push(`/masters/particulars?highlight=${state.newId}`);
    }
  }, [state?.success, state?.newId, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldSet>
        <FieldLegend variant="label">Particular</FieldLegend>
        <Field>
          <FieldLabel htmlFor="name">Particular name</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={particular?.name}
            required
            className="h-11 text-base"
          />
          <FieldDescription>
            You can type in Gujarati (for example ગળુ) or English.
          </FieldDescription>
          <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="defaultPrice">Default price (₹)</FieldLabel>
          <Input
            id="defaultPrice"
            name="defaultPrice"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={particular?.defaultPrice}
            required
            className="h-11 text-base tnum"
          />
          {isEdit ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <FieldDescription>
                This changes new job works only. Past job works keep the price they were saved
                with.
              </FieldDescription>
            </div>
          ) : null}
          <FieldError errors={[{ message: state?.fieldErrors?.defaultPrice }]} />
        </Field>
      </FieldSet>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton isEdit={isEdit} />
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  createKarigarAction,
  updateKarigarAction,
  type KarigarFormState,
} from "./actions";
import type { SilaiKarigar } from "@/lib/db/repositories/karigars";
import { MultiSelect } from "@/components/multi-select";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 px-5">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function KarigarForm({
  karigar,
  parties,
  linkedPartyIds = [],
}: {
  karigar?: SilaiKarigar;
  parties?: { id: string; name: string }[];
  linkedPartyIds?: string[];
}) {
  const router = useRouter();
  const isEdit = !!karigar;

  const action = isEdit
    ? updateKarigarAction.bind(null, karigar.id)
    : createKarigarAction;

  const [state, formAction] = useActionState<KarigarFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success && state.newId) {
      router.push(`/karigars?highlight=${state.newId}`);
    }
  }, [state?.success, state?.newId, router]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {/* The fields scroll; the action bar below is a SIBLING, not an overlay.
          Sticky-inside-the-scroller left the scrollbar running behind the
          footer, which looked broken. */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 sm:p-6">
      <FieldGroup>
        <FieldSet>
          <div className="grid gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={karigar?.name}
              required
              className="h-[42px]"
            />
            <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
          </Field>
        </div>
        </FieldSet>

        <FieldSet>
          <div className="grid gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          <Field>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Input
              id="address"
              name="address"
              defaultValue={karigar?.address ?? undefined}
              className="h-[42px]"
            />
            <FieldError errors={[{ message: state?.fieldErrors?.address }]} />
          </Field>
          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="contact1">Contact 1</FieldLabel>
              <Input
                id="contact1"
                name="contact1"
                type="tel"
                defaultValue={karigar?.contact1 ?? undefined}
                className="h-[42px]"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.contact1 }]} />
            </FieldContent>
            <FieldContent>
              <FieldLabel htmlFor="contact2">Contact 2</FieldLabel>
              <Input
                id="contact2"
                name="contact2"
                type="tel"
                defaultValue={karigar?.contact2 ?? undefined}
                className="h-[42px]"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.contact2 }]} />
            </FieldContent>
          </Field>
        </div>
        </FieldSet>

        <FieldSet>
          <div className="grid gap-x-4 gap-y-2">
          {parties && parties.length > 0 ? (
            <>
              <MultiSelect
                name="partyIds"
                options={parties.map((p) => ({ id: p.id, label: p.name }))}
                defaultSelected={linkedPartyIds}
                placeholder="Select parties"
                searchPlaceholder="Search parties"
                emptyText="No party found."
              />
              <FieldDescription className="sm:col-span-full">
                Only these parties will offer this karigar when you record a job
                work. Existing job works are never affected by changing this.
              </FieldDescription>
            </>
          ) : (
            <FieldDescription>
              No parties yet. <Link href="/parties/new">Add a party</Link>
            </FieldDescription>
          )}
        </div>
        </FieldSet>
      </FieldGroup>

      </div>

      {state?.error ? (
        <p role="alert" className="shrink-0 px-5 pb-3 text-sm text-destructive sm:px-6">
          {state.error}
        </p>
      ) : null}

      {state?.duplicateWarning ? (
        <div className="m-5 flex shrink-0 flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 sm:m-6">
          <p className="text-sm text-warning-foreground">{state.duplicateWarning}</p>
          <input type="hidden" name="confirmDuplicate" value="true" />
          <div className="flex gap-2">
            <SubmitButton label="Add anyway" pendingLabel="Adding..." />
            <Button asChild variant="outline" className="h-[42px]">
              <Link href="/karigars">Cancel</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5 sm:px-6">
          <Button asChild variant="outline" className="h-10 px-4">
            <Link href="/karigars">Cancel</Link>
          </Button>
          <SubmitButton
            label={isEdit ? "Save changes" : "Add karigar"}
            pendingLabel="Saving…"
          />
        </div>
      )}
    </form>
  );
}

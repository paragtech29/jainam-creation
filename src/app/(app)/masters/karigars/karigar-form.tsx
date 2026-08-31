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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  createKarigarAction,
  updateKarigarAction,
  type KarigarFormState,
} from "./actions";
import type { SilaiKarigar } from "@/lib/db/repositories/karigars";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full text-base">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function KarigarForm({
  karigar,
  parties,
}: {
  karigar?: SilaiKarigar;
  parties?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isEdit = !!karigar;

  const action = isEdit
    ? updateKarigarAction.bind(null, karigar.id)
    : createKarigarAction;

  const [state, formAction] = useActionState<KarigarFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success && state.newId) {
      router.push(`/masters/karigars?highlight=${state.newId}`);
    }
  }, [state?.success, state?.newId, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Karigar</FieldLegend>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={karigar?.name}
              required
              className="h-11 text-base"
            />
            <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
          </Field>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Contact</FieldLegend>
          <Field>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Input
              id="address"
              name="address"
              defaultValue={karigar?.address ?? undefined}
              className="h-11 text-base"
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
                className="h-11 text-base"
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
                className="h-11 text-base"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.contact2 }]} />
            </FieldContent>
          </Field>
        </FieldSet>

        {!isEdit ? (
          <FieldSet>
            <FieldLegend variant="label">Parties this karigar works for</FieldLegend>
            {parties && parties.length > 0 ? (
              <>
                <div className="flex flex-col gap-2">
                  {parties.map((p) => (
                    <label
                      key={p.id}
                      className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
                    >
                      <input type="checkbox" name="partyIds" value={p.id} className="size-5" />
                      <span className="text-sm text-foreground">{p.name}</span>
                    </label>
                  ))}
                </div>
                <FieldDescription>
                  Optional — you can also change this later from each party&apos;s screen.
                </FieldDescription>
              </>
            ) : (
              <FieldDescription>
                No parties yet.{" "}
                <Link href="/masters/parties/new">Add a party</Link>
              </FieldDescription>
            )}
          </FieldSet>
        ) : null}
      </FieldGroup>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state?.duplicateWarning ? (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm text-warning-foreground">{state.duplicateWarning}</p>
          <input type="hidden" name="confirmDuplicate" value="true" />
          <div className="flex gap-2">
            <SubmitButton label="Add anyway" pendingLabel="Adding..." />
            <Button asChild variant="outline" className="h-11 w-full text-base">
              <Link href="/masters/karigars">Cancel</Link>
            </Button>
          </div>
        </div>
      ) : (
        <SubmitButton
          label={isEdit ? "Save changes" : "Add karigar"}
          pendingLabel={isEdit ? "Saving..." : "Adding..."}
        />
      )}
    </form>
  );
}

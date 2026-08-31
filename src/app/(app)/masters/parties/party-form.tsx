"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { createPartyAction, updatePartyAction, type PartyFormState } from "./actions";
import type { getPartyById } from "@/lib/db/repositories/parties";

// Derived from the repository's own return type (never the raw schema
// import) so this file stays clear of the ESLint no-restricted-imports
// rule that guards userId-scoped DB access.
type Party = NonNullable<Awaited<ReturnType<typeof getPartyById>>>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full text-base">
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function PartyForm({ party }: { party?: Party }) {
  const router = useRouter();
  const action = party ? updatePartyAction.bind(null, party.id) : createPartyAction;
  const [state, formAction] = useActionState<PartyFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success && state.newId) {
      router.push(`/masters/parties?highlight=${state.newId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">Party</FieldLegend>
        <Field>
          <FieldLabel htmlFor="name">Party name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            defaultValue={party?.name}
            className="h-11 text-base"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Owners</FieldLegend>
        <Field>
          <FieldLabel htmlFor="ownerName1">Owner name 1</FieldLabel>
          <Input
            id="ownerName1"
            name="ownerName1"
            required
            defaultValue={party?.ownerName1}
            className="h-11 text-base"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.ownerName1 }]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ownerName2">Owner name 2 (optional)</FieldLabel>
          <Input
            id="ownerName2"
            name="ownerName2"
            defaultValue={party?.ownerName2 ?? ""}
            className="h-11 text-base"
          />
        </Field>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Contact</FieldLegend>
        <Field>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Input
            id="address"
            name="address"
            defaultValue={party?.address ?? ""}
            className="h-11 text-base"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="gender">Gender</FieldLabel>
          <select
            id="gender"
            name="gender"
            defaultValue={party?.gender ?? ""}
            className="h-11 rounded-md border border-border bg-background px-3 text-base"
          >
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={party?.email ?? ""}
            className="h-11 text-base"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.email }]} />
        </Field>
        <Field orientation="responsive">
          <FieldContent>
            <FieldLabel htmlFor="contact1">Contact 1</FieldLabel>
            <Input
              id="contact1"
              name="contact1"
              type="tel"
              defaultValue={party?.contact1 ?? ""}
              className="h-11 text-base"
            />
          </FieldContent>
          <FieldContent>
            <FieldLabel htmlFor="contact2">Contact 2</FieldLabel>
            <Input
              id="contact2"
              name="contact2"
              type="tel"
              defaultValue={party?.contact2 ?? ""}
              className="h-11 text-base"
            />
          </FieldContent>
        </Field>
      </FieldSet>

      {state?.duplicateWarning ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm text-warning-foreground">{state.duplicateWarning}</p>
          <input type="hidden" name="confirmDuplicate" value="true" />
          <div className="mt-3 flex gap-2">
            <Button type="submit" className="h-11 flex-1 text-base">
              Add anyway
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1 text-base">
              <Link href="/masters/parties">Cancel</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <SubmitButton label={party ? "Save changes" : "Add party"} />
        </>
      )}
    </form>
  );
}

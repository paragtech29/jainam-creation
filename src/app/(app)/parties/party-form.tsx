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
    <Button type="submit" disabled={pending} className="h-10 px-5">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function PartyForm({ party }: { party?: Party }) {
  const router = useRouter();
  const action = party ? updatePartyAction.bind(null, party.id) : createPartyAction;
  const [state, formAction] = useActionState<PartyFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success && state.newId) {
      router.push(`/parties?highlight=${state.newId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {/* The fields scroll; the action bar below is a SIBLING, not an overlay.
          Sticky-inside-the-scroller left the scrollbar running behind the
          footer, which looked broken. */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 sm:p-6">
      <FieldSet>
        <div className="grid gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <Field>
          <FieldLabel htmlFor="name">Party name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            defaultValue={party?.name}
            className="h-[42px]"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.name }]} />
        </Field>
      </div>
      </FieldSet>

      <FieldSet>
        <div className="grid gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <Field>
          <FieldLabel htmlFor="ownerName1">Owner name 1</FieldLabel>
          <Input
            id="ownerName1"
            name="ownerName1"
            required
            defaultValue={party?.ownerName1}
            className="h-[42px]"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.ownerName1 }]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ownerName2">Owner name 2 (optional)</FieldLabel>
          <Input
            id="ownerName2"
            name="ownerName2"
            defaultValue={party?.ownerName2 ?? ""}
            className="h-[42px]"
          />
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
            defaultValue={party?.address ?? ""}
            className="h-[42px]"
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
            className="h-[42px]"
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
              className="h-[42px]"
            />
          </FieldContent>
          <FieldContent>
            <FieldLabel htmlFor="contact2">Contact 2</FieldLabel>
            <Input
              id="contact2"
              name="contact2"
              type="tel"
              defaultValue={party?.contact2 ?? ""}
              className="h-[42px]"
            />
          </FieldContent>
        </Field>
      </div>
      </FieldSet>

      </div>

      {state?.duplicateWarning ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm text-warning-foreground">{state.duplicateWarning}</p>
          <input type="hidden" name="confirmDuplicate" value="true" />
          <div className="mt-3 flex gap-2">
            <Button type="submit" className="h-10 px-4">
              Add anyway
            </Button>
            <Button asChild variant="outline" className="h-10 px-4">
              <Link href="/parties">Cancel</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {state?.error ? (
            <p role="alert" className="shrink-0 px-5 pb-3 text-sm text-destructive sm:px-6">
              {state.error}
            </p>
          ) : null}
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5 sm:px-6">
            <Button asChild variant="outline" className="h-10 px-4">
              <Link href="/parties">Cancel</Link>
            </Button>
            <SubmitButton label={party ? "Save changes" : "Add party"} />
          </div>
        </>
      )}
    </form>
  );
}

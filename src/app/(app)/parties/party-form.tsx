"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";
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
  // Gender is required. It starts empty so the schema's "Choose a gender"
  // actually fires on a blank submit, rather than a default silently
  // satisfying it.
  const [gender, setGender] = useState(party?.gender ?? "");
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
            minLength={2}
            maxLength={120}
            // Must contain a letter. Digits are fine inside a business name
            // ("3 Star Creation") but not on their own.
            pattern="(?=.*[A-Za-z-￿]).{2,}"
            title="At least 2 characters, and must contain letters — not only numbers"
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
            minLength={2}
            maxLength={80}
            pattern="[A-Za-z-￿ .'-]{2,}"
            title="Letters, spaces, dots, hyphens and apostrophes only — no numbers"
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
            minLength={2}
            maxLength={80}
            pattern="[A-Za-z-￿ .'-]{2,}"
            title="Letters, spaces, dots, hyphens and apostrophes only — no numbers"
            defaultValue={party?.ownerName2 ?? ""}
            className="h-[42px]"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.ownerName2 }]} />
        </Field>
      </div>
      </FieldSet>

      <FieldSet>
        <div className="grid gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <Field className="[grid-column:1/-1]">
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Textarea
            id="address"
            name="address"
            rows={2}
            maxLength={500}
            placeholder="Shop / street / area, city"
            defaultValue={party?.address ?? ""}
            className="min-h-[62px] resize-y"
          />
          <FieldError errors={[{ message: state?.fieldErrors?.address }]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="gender">Gender</FieldLabel>
          <SimpleSelect
            id="gender"
            name="gender"
            value={gender}
            onValueChange={setGender}
            placeholder="Choose gender"
            fullWidth
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
          />
          <FieldError errors={[{ message: state?.fieldErrors?.gender }]} />
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
              required
              inputMode="tel"
              pattern="[0-9+-s()]{10,20}"
              maxLength={20}
              title="Numbers only — 10 to 15 digits. Spaces, + - and brackets are allowed."
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
              inputMode="tel"
              pattern="[0-9+-s()]{10,20}"
              maxLength={20}
              title="Numbers only — 10 to 15 digits. Spaces, + - and brackets are allowed."
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

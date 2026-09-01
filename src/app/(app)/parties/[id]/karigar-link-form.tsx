"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { linkKarigarsAction } from "../actions";
import { Button } from "@/components/ui/button";
import {
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save linked karigars"}
    </Button>
  );
}

export function KarigarLinkForm({
  partyId,
  karigars,
  linkedIds,
}: {
  partyId: string;
  karigars: { id: string; name: string }[];
  linkedIds: string[];
}) {
  const action = linkKarigarsAction.bind(null, partyId);

  return (
    <form action={action}>
      <FieldSet>
        <FieldLegend variant="label">Silai karigars</FieldLegend>
        <FieldDescription>
          Tick the karigars who work for this party. They will be the only
          ones offered when you record a job work for it.
        </FieldDescription>

        {karigars.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No karigars yet.{" "}
            <Link href="/karigars/new" className="underline underline-offset-4 hover:text-primary">
              Add one
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {karigars.map((k) => (
              <label
                key={k.id}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name="karigarIds"
                  value={k.id}
                  defaultChecked={linkedIds.includes(k.id)}
                  className="size-5"
                />
                <span>{k.name}</span>
              </label>
            ))}
          </div>
        )}

        {karigars.length > 0 && (
          <div className="flex flex-col gap-2">
            <SubmitButton />
            <p className="text-sm text-muted-foreground">
              Unticking a karigar only stops offering him for this party&apos;s
              new job works. His existing job works are not changed.
            </p>
          </div>
        )}
      </FieldSet>
    </form>
  );
}

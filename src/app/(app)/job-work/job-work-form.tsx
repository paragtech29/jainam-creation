"use client";

// The job work form — the screen this entire application exists to provide.
// Modeled on karigar-form.tsx: useActionState + the field primitive +
// useFormStatus SubmitButton, with a useEffect that clears the draft and
// redirects on success.
//
// PITFALL — never key a child on the action state. Doing something like
// <DescriptionRows key={JSON.stringify(state)}> would remount the rows (and
// wipe every typed row) the moment a server validation error comes back,
// which is precisely the half-filled-form-destroyed bug this whole plan
// exists to avoid. Nothing in this file keys a child on `state`.
import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createJobWorkAction, updateJobWorkAction, type JobWorkFormState } from "./actions";
import { linkSingleKarigarAction } from "../parties/actions";
import { DescriptionRows } from "./description-rows";
import { useDerivedRate } from "./use-derived-rate";
import { useJobWorkDraft, type JobWorkDraft } from "./use-job-work-draft";

type JobWorkStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

// The four status colours were defined back in Phase 2 precisely so these
// states stay tellable apart at a glance — this screen is where they earn it.
const STATUS_OPTIONS: { value: JobWorkStatus; label: string; dot: string }[] = [
  { value: "PENDING", label: "Pending", dot: "bg-status-pending" },
  { value: "IN_PROGRESS", label: "In Progress", dot: "bg-status-progress" },
  { value: "COMPLETED", label: "Completed", dot: "bg-status-completed" },
];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 px-5">
      {pending ? pendingLabel : label}
    </Button>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function JobWorkForm({
  jobWork,
  parties,
  karigars,
  karigarPartyLinks,
  descriptionTypes,
}: {
  jobWork?: {
    id: string;
    date: string;
    partyId: string;
    karigarId: string;
    chalanNo: string | null;
    partyDesignNo: string | null;
    computerDesignNo: string | null;
    pieces: number;
    rate: number;
    comment: string | null;
    status: JobWorkStatus;
    isBilled: boolean;
    lines: { descriptionTypeId: string; priceUsed: number }[];
  };
  parties: { id: string; name: string }[];
  karigars: { id: string; name: string }[];
  karigarPartyLinks: { karigarId: string; partyId: string }[];
  descriptionTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isEdit = !!jobWork;

  const action = isEdit
    ? updateJobWorkAction.bind(null, jobWork.id)
    : createJobWorkAction;
  const [state, formAction] = useActionState<JobWorkFormState, FormData>(action, undefined);

  // Draft key convention: two different job works being edited must never
  // share a draft, so the edit key is namespaced by id.
  const draftKey = jobWork ? `jobwork-draft-edit-${jobWork.id}` : "jobwork-draft-new";
  const initialDraft: JobWorkDraft = {
    date: jobWork?.date ?? todayISO(),
    partyId: jobWork?.partyId ?? "",
    karigarId: jobWork?.karigarId ?? "",
    pieces: jobWork ? String(jobWork.pieces) : "",
    rate: jobWork ? String(jobWork.rate) : "",
    rateTouched: jobWork ? jobWork.rate !== jobWork.lines.reduce((a, l) => a + l.priceUsed, 0) : false,
    chalanNo: jobWork?.chalanNo ?? "",
    partyDesignNo: jobWork?.partyDesignNo ?? "",
    computerDesignNo: jobWork?.computerDesignNo ?? "",
    comment: jobWork?.comment ?? "",
    status: jobWork?.status ?? "PENDING",
    isBilled: jobWork?.isBilled ?? false,
    rows: [],
  };
  const { draft, setDraft, clearDraft } = useJobWorkDraft(draftKey, initialDraft);

  // DescriptionRows emits the FULL rows (type id + price), so both the live
  // rate and the sessionStorage draft work from the same source. Restoring a
  // draft with prices but blank types would leave the owner re-picking the
  // fiddliest part of the form, which would defeat the point of the draft.
  const [rows, setRows] = useState<{ descriptionTypeId: string; price: string }[]>(
    jobWork
      ? jobWork.lines.map((l) => ({
          descriptionTypeId: l.descriptionTypeId,
          price: String(l.priceUsed),
        }))
      : initialDraft.rows
  );

  // Only complete, positive integer prices feed the rate — a half-typed row
  // must not make the total flicker to something wrong.
  const rowPrices = rows
    .map((r) => Number(r.price))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0);

  const rateHook = useDerivedRate(rowPrices, jobWork?.rate, initialDraft.rateTouched);

  // Keep the draft's rate/rateTouched mirror in sync (one-way: draft mirrors
  // the hook, the hook is never driven by the draft after initial mount).
  useEffect(() => {
    setDraft((d) =>
      d.rate === rateHook.rate && d.rateTouched === rateHook.touched
        ? d
        : { ...d, rate: rateHook.rate, rateTouched: rateHook.touched }
    );
  }, [rateHook.rate, rateHook.touched, setDraft]);

  // Mirror the full rows into the draft, so a refresh restores both the type
  // picked on each row and its price.
  useEffect(() => {
    setDraft((d) =>
      JSON.stringify(d.rows) === JSON.stringify(rows) ? d : { ...d, rows }
    );
  }, [rows, setDraft]);

  useEffect(() => {
    if (state?.success && state.newId) {
      clearDraft();
      router.push(`/job-work?highlight=${state.newId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success, state?.newId]);

  const selectedPartyId = draft.partyId;
  const linkedKarigars = karigars.filter((k) =>
    karigarPartyLinks.some((l) => l.karigarId === k.id && l.partyId === selectedPartyId)
  );
  const unlinkedKarigars = karigars.filter(
    (k) => !linkedKarigars.some((lk) => lk.id === k.id)
  );

  const [linkingKarigarId, setLinkingKarigarId] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkPending, startLinkTransition] = useTransition();

  function handleLinkKarigar() {
    if (!selectedPartyId || !linkingKarigarId) return;
    startLinkTransition(async () => {
      const res = await linkSingleKarigarAction(selectedPartyId, linkingKarigarId);
      if ("error" in res) {
        setLinkError(res.error);
        return;
      }
      setLinkError(null);
      setDraft((d) => ({ ...d, karigarId: linkingKarigarId }));
      setLinkingKarigarId("");
      // Re-runs the server page's data fetch without unmounting this client
      // component's state — the half-filled form (backed by the draft
      // anyway) survives.
      router.refresh();
    });
  }

  const pieces = Number(draft.pieces) || 0;
  const rateNum = Number(rateHook.rate) || 0;
  const totalPreview = pieces * rateNum;

  function handleStatusChange(value: JobWorkStatus) {
    setDraft((d) => ({
      ...d,
      status: value,
      // If status leaves Completed while Is Billed is on, turn it off in the
      // same handler so what he sees on screen is what will be posted — the
      // server enforces this independently regardless (03-02).
      isBilled: value === "COMPLETED" ? d.isBilled : false,
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Job work</FieldLegend>
          {/* Three-up on a laptop, stacked on a phone. Date, party and karigar
              are chosen together in one glance, so they belong on one line
              where the width exists. */}
          <div className="grid gap-4 lg:grid-cols-3">

          <Field>
            <FieldLabel htmlFor="date">Date</FieldLabel>
            <Input
              id="date"
              name="date"
              type="date"
              required
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="h-[42px] font-mono tabular-nums"
            />
            <FieldError errors={[{ message: state?.fieldErrors?.date }]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="partyId">Party</FieldLabel>
            <Select
              name="partyId"
              value={draft.partyId}
              onValueChange={(v) =>
                // Changing the party invalidates any previously-selected
                // karigar — a karigar linked to Mayra is not valid for
                // Jignesh bhai, so leaving the old selection would post a
                // link that does not exist.
                setDraft((d) => ({ ...d, partyId: v, karigarId: "" }))
              }
            >
              <SelectTrigger id="partyId" className="h-[42px] w-full">
                <SelectValue placeholder="Select a party" />
              </SelectTrigger>
              <SelectContent>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[{ message: state?.fieldErrors?.partyId }]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="karigarId">Silai Karigar</FieldLabel>
            {!selectedPartyId ? (
              <>
                <Select name="karigarId" value="" disabled>
                  <SelectTrigger id="karigarId" className="h-[42px] w-full">
                    <SelectValue placeholder="Choose a party first" />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                <FieldDescription>Choose a party first.</FieldDescription>
              </>
            ) : linkedKarigars.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <FieldDescription>
                  No karigars are linked to this party yet. Link one now to continue.
                </FieldDescription>
                {/* Hidden so karigarId still posts if a value was set before the
                    party temporarily had zero linked karigars (edge case,
                    belt-and-braces). */}
                <input type="hidden" name="karigarId" value={draft.karigarId} />
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={linkingKarigarId} onValueChange={setLinkingKarigarId}>
                      <SelectTrigger className="h-[42px] w-full">
                        <SelectValue placeholder="Pick a karigar to link" />
                      </SelectTrigger>
                      <SelectContent>
                        {unlinkedKarigars.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    disabled={!linkingKarigarId || linkPending}
                    onClick={handleLinkKarigar}
                    className="h-[42px]"
                  >
                    {linkPending ? "Linking..." : "Link"}
                  </Button>
                </div>
                {linkError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {linkError}
                  </p>
                ) : null}
              </div>
            ) : (
              <Select
                name="karigarId"
                value={draft.karigarId}
                onValueChange={(v) => setDraft((d) => ({ ...d, karigarId: v }))}
                required
              >
                <SelectTrigger id="karigarId" className="h-[42px] w-full">
                  <SelectValue placeholder="Select a karigar" />
                </SelectTrigger>
                <SelectContent>
                  {linkedKarigars.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError errors={[{ message: state?.fieldErrors?.karigarId }]} />
          </Field>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Work done</FieldLegend>

          <DescriptionRows
            types={descriptionTypes}
            initialRows={
              rows.length > 0
                ? rows.map((r) => ({
                    descriptionTypeId: r.descriptionTypeId,
                    price: Number(r.price) || 0,
                  }))
                : undefined
            }
            onRowsChange={setRows}
            error={state?.fieldErrors?.lines}
          />

          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="pieces">Pieces</FieldLabel>
              <Input
                id="pieces"
                name="pieces"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={draft.pieces}
                onChange={(e) => setDraft((d) => ({ ...d, pieces: e.target.value }))}
                className="h-[42px] text-right font-mono tabular-nums"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.pieces }]} />
            </FieldContent>

            <FieldContent>
              <FieldLabel htmlFor="rate">Rate</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="rate"
                  name="rate"
                  inputMode="numeric"
                  value={rateHook.rate}
                  onChange={(e) => rateHook.onRateChange(e.target.value)}
                  className="h-[42px] pl-6 text-right font-mono tabular-nums"
                />
              </div>
              {!rateHook.touched ? (
                <FieldDescription>Adds up the rows above.</FieldDescription>
              ) : (
                <FieldDescription className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-status-pending-bg px-2 py-0.5 text-[11px] font-medium text-status-pending">
                    Set by you
                  </span>
                  {Number(rateHook.rate) !== rateHook.computedSum ? (
                    <button
                      type="button"
                      onClick={rateHook.resetToAuto}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Use auto (₹{rateHook.computedSum.toLocaleString("en-IN")})
                    </button>
                  ) : null}
                </FieldDescription>
              )}
              <FieldError errors={[{ message: state?.fieldErrors?.rate }]} />
            </FieldContent>
          </Field>

          {/* The money line, shown as the sum it is. Pieces × rate, spelled
              out, so a wrong figure is obvious before saving rather than
              after. The server recomputes this — the browser never decides it. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-accent/50 px-4 py-3">
            <div className="flex items-baseline gap-1.5 font-mono text-sm tabular-nums text-secondary-foreground">
              <span>{draft.pieces || 0}</span>
              <span className="text-muted-foreground">pieces</span>
              <span className="text-muted-foreground">×</span>
              <span>₹{rateHook.rate || 0}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-[0.09em] text-muted-foreground">Total</span>
              <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                ₹{totalPreview.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Design numbers</FieldLegend>
          <div className="grid gap-4 lg:grid-cols-3">

          <Field>
            <FieldLabel htmlFor="chalanNo">Chalan No</FieldLabel>
            <Input
              id="chalanNo"
              name="chalanNo"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.chalanNo}
              onChange={(e) => setDraft((d) => ({ ...d, chalanNo: e.target.value }))}
              className="h-[42px] font-mono tabular-nums"
            />
            <FieldDescription>
              The same chalan no. can be used on more than one job work.
            </FieldDescription>
            <FieldError errors={[{ message: state?.fieldErrors?.chalanNo }]} />
          </Field>

          <Field orientation="responsive">
            <FieldContent>
              <FieldLabel htmlFor="partyDesignNo">Party Design No</FieldLabel>
              <Input
                id="partyDesignNo"
                name="partyDesignNo"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.partyDesignNo}
                onChange={(e) => setDraft((d) => ({ ...d, partyDesignNo: e.target.value }))}
                className="h-[42px] font-mono tabular-nums"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.partyDesignNo }]} />
            </FieldContent>
            <FieldContent>
              <FieldLabel htmlFor="computerDesignNo">Computer Design No</FieldLabel>
              <Input
                id="computerDesignNo"
                name="computerDesignNo"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.computerDesignNo}
                onChange={(e) => setDraft((d) => ({ ...d, computerDesignNo: e.target.value }))}
                className="h-[42px] font-mono tabular-nums"
              />
              <FieldError errors={[{ message: state?.fieldErrors?.computerDesignNo }]} />
            </FieldContent>
          </Field>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Notes & status</FieldLegend>

          <Field>
            <FieldLabel htmlFor="comment">Comments</FieldLabel>
            <Textarea
              id="comment"
              name="comment"
              value={draft.comment}
              onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
              className="min-h-20"
            />
            <FieldError errors={[{ message: state?.fieldErrors?.comment }]} />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="status">Job Work Status</FieldLabel>
            <Select
              name="status"
              value={draft.status}
              onValueChange={(v) => handleStatusChange(v as JobWorkStatus)}
            >
              <SelectTrigger id="status" className="h-[42px] w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${o.dot}`} aria-hidden="true" />
                      {o.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[{ message: state?.fieldErrors?.status }]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="isBilled">Is Billed</FieldLabel>
            {/* Deliberately NOT shaped like the Select beside it. Matching the
                input border made this read as a text field you could type in,
                when it is a toggle. */}
            <label
              htmlFor="isBilled"
              className={cn(
                "flex min-h-[42px] items-center justify-between gap-3 rounded-[10px] px-3 py-2 transition-colors",
                draft.status !== "COMPLETED"
                  ? "cursor-not-allowed bg-muted"
                  : draft.isBilled
                    ? "cursor-pointer bg-status-billed-bg"
                    : "cursor-pointer bg-accent/60 hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2 text-sm">
                {draft.status !== "COMPLETED" ? (
                  <>
                    <Lock size={14} className="text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Mark Completed first</span>
                  </>
                ) : draft.isBilled ? (
                  <span className="font-medium text-status-billed">Bill has been made</span>
                ) : (
                  <span className="text-secondary-foreground">Not billed yet</span>
                )}
              </span>
              <Switch
                id="isBilled"
                name="isBilled"
                checked={draft.isBilled}
                disabled={draft.status !== "COMPLETED"}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, isBilled: checked }))}
              />
            </label>
          </Field>
          </div>

          {/* Photos are Phase 4's scope — no upload UI here, and photo1Url /
              photo2Url are never posted from this form. */}
        </FieldSet>
      </FieldGroup>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="-mx-5 -mb-5 flex items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5 sm:-mx-6 sm:-mb-6 sm:px-6">
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href="/job-work">Cancel</Link>
        </Button>
        <SubmitButton
          label={isEdit ? "Save changes" : "Save job work"}
          pendingLabel="Saving…"
        />
      </div>
    </form>
  );
}

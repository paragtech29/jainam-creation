"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Eye, EyeOff } from "lucide-react";
import { Req } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { changePasswordAction, type ChangePasswordState } from "./actions";

/**
 * The rules shown as a live checklist. They are the SAME three the server
 * enforces in `changePasswordSchema` — a checklist that ticks rules nobody
 * checks is decoration, and one that blocks on rules the server does not have
 * is a policy invented by a component. If one moves, both move.
 */
const RULES: { label: string; ok: (v: string) => boolean }[] = [
  { label: "At least 8 characters", ok: (v) => v.length >= 8 },
  { label: "One letter", ok: (v) => /[a-zA-Z]/.test(v) },
  { label: "One number", ok: (v) => /[0-9]/.test(v) },
];

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || !ready}
      // Says WHY it is disabled, rather than being a dead grey rectangle.
      title={!ready && !pending ? "Fill in all three fields first" : undefined}
      className="h-10 px-5"
    >
      {pending ? "Changing…" : "Change password"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    undefined
  );
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [show, setShow] = useState(false);

  // Clearing the boxes after a successful change, WITHOUT an effect: this
  // project lints react-hooks/set-state-in-effect as a hard error, and the
  // sanctioned alternative is adjusting state during render when a prop-like
  // input changes. React re-runs this render immediately and nothing below
  // sees the stale values.
  const [clearedFor, setClearedFor] = useState(false);
  if (state?.success && !clearedFor) {
    setClearedFor(true);
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    setShow(false);
  } else if (!state?.success && clearedFor) {
    setClearedFor(false);
  }

  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const matched = confirmPw.length > 0 && newPw === confirmPw;
  // Only gates on the fields being filled. The RULES are shown, not enforced
  // here — the server owns that, and a button that refuses to be pressed
  // cannot tell you which rule you missed.
  const ready = oldPw.length > 0 && newPw.length > 0 && confirmPw.length > 0;

  const field = "h-11";

  return (
    <form action={formAction} noValidate className="flex flex-col">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex max-w-[420px] flex-col gap-1.5">
          <Label htmlFor="oldPassword">
            Current password <Req />
          </Label>
          <Input
            id="oldPassword"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Enter current password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            className={field}
          />
          {state?.fieldErrors?.oldPassword ? (
            <p role="alert" data-slot="field-error" className="text-xs text-destructive">
              {state.fieldErrors.oldPassword}
            </p>
          ) : null}
        </div>

        <div className="grid max-w-[640px] gap-x-4 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">
              New password <Req />
            </Label>
            <Input
              id="newPassword"
              name="newPassword"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={field}
            />
            {state?.fieldErrors?.newPassword ? (
              <p role="alert" data-slot="field-error" className="text-xs text-destructive">
                {state.fieldErrors.newPassword}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">
              Confirm new password <Req />
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              aria-invalid={mismatch || undefined}
              className={cn(field, mismatch && "border-destructive")}
            />
            {state?.fieldErrors?.confirmPassword ? (
              <p role="alert" data-slot="field-error" className="text-xs text-destructive">
                {state.fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {show ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>

          {/* Says so the moment it is true, rather than after a round trip. */}
          {mismatch ? (
            <span className="text-[12.5px] font-medium text-destructive">
              Both passwords must match
            </span>
          ) : matched ? (
            <span className="text-[12.5px] font-medium text-success">Passwords match</span>
          ) : null}
        </div>

        <div className="flex max-w-[420px] flex-col gap-2 rounded-xl border border-border bg-muted/40 p-[13px_15px]">
          <span className="text-[11px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
            Password should have
          </span>
          {RULES.map((r) => {
            const ok = r.ok(newPw);
            return (
              <div key={r.label} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[17px] shrink-0 items-center justify-center rounded-full transition-colors",
                    ok ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground/70"
                  )}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className={cn("text-[12.5px]", ok ? "text-foreground" : "text-muted-foreground")}>
                  {r.label}
                </span>
              </div>
            );
          })}
        </div>

        {state?.error ? (
          <p role="alert" data-slot="field-error" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
        {state?.success ? (
          <p role="status" className="text-sm font-medium text-success">
            Password changed.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-3.5">
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4"
          onClick={() => {
            setOldPw("");
            setNewPw("");
            setConfirmPw("");
            setShow(false);
          }}
        >
          Clear
        </Button>
        <SubmitButton ready={ready} />
      </div>
    </form>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyIllustration } from "@/components/empty-illustration";

/**
 * An empty list is a pause, not a dead end: it should say why the screen is
 * blank and point at the one action that fills it.
 *
 * Two registers, deliberately different:
 *
 *  - First run (`steps` given) — the user has never had data, so this is an
 *    onboarding surface. It teaches the flow and points at the page's own
 *    action button rather than growing a second one. A page whose header
 *    already carries "Add party" does not need a second Add party in the
 *    middle of the card; two buttons for one action is a choice the user
 *    then has to think about.
 *
 *  - A filter that matched nothing — nothing is wrong and nothing needs
 *    teaching, so it stays short and quiet.
 *
 * `actionLabel`/`actionHref` remain for BLOCKING states, where the CTA is
 * genuinely the only way forward and no header button exists — the "add a
 * party before you can record a job work" case.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  hint,
  steps,
  fill = false,
  variant = "page",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** Points at an action that already exists elsewhere on the page. */
  hint?: string;
  /** First-run only: the three steps this record sits in. */
  steps?: string[];
  /** Grow to fill the page body instead of leaving dead space beneath. */
  fill?: boolean;
  /** "search" for a filter that matched nothing; "page" for first run. */
  variant?: "page" | "search";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center",
        fill ? "flex-1 py-10" : "py-14"
      )}
    >
      <EmptyIllustration icon={Icon} variant={variant} />

      <h2 className="mt-6 font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>

      {hint ? (
        <p className="mt-4 text-sm text-muted-foreground">{hint}</p>
      ) : null}

      {steps?.length ? (
        <>
          {/* A hairline keeps the teaching block from reading as part of the
              message above it. */}
          <div className="mt-7 h-px w-full max-w-md bg-border" />
          <ol className="mt-6 grid w-full max-w-2xl gap-5 text-left sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-brand-dark">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {actionLabel && actionHref ? (
        <Button asChild className="mt-6 h-10">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

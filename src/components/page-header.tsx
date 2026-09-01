import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Title left, primary action right on the same row — the near-universal
// pattern for a data screen. No floating action button: this app is used on
// a laptop as much as a phone.
export function PageHeader({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && actionHref ? (
        <Button asChild className="h-10 shrink-0">
          <Link href={actionHref}>
            <Plus size={16} aria-hidden="true" />
            {actionLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

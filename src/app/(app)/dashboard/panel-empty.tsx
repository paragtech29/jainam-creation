import Link from "next/link";

/**
 * The empty state INSIDE a dashboard panel.
 *
 * Deliberately not the big `EmptyState` used for a whole page: this one sits
 * in a card beside a populated sibling, so it has to be quiet. It is still a
 * designed surface rather than a bare sentence — an icon to break the
 * flatness, one line saying what is missing, one line saying what would fill
 * it, and an action only where there is genuinely something to do.
 */
export function PanelEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-[22px] py-9 text-center">
      <div className="flex size-11 items-center justify-center rounded-[13px] bg-muted text-muted-foreground">
        {icon}
      </div>
      <span className="text-sm font-semibold">{title}</span>
      <span className="max-w-[230px] text-[12.5px] leading-relaxed text-muted-foreground">
        {body}
      </span>
      {action ? (
        <Link
          href={action.href}
          className="mt-0.5 inline-flex h-[38px] items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

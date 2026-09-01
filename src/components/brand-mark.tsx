import { cn } from "@/lib/utils";

export function BrandMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-primary font-bold tracking-tight text-primary-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
      aria-hidden="true"
    >
      JC
    </div>
  );
}

// `onDark` for the sidebar rail; the default is for light surfaces.
export function BrandLockup({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark size={34} />
      <div className="flex min-w-0 flex-col leading-[1.15]">
        <span
          className={cn(
            "truncate text-sm font-semibold tracking-tight",
            onDark ? "text-white" : "text-foreground"
          )}
        >
          Jainam Creation
        </span>
        <span
          className={cn(
            "truncate text-[11px]",
            onDark ? "text-sidebar-meta" : "text-muted-foreground"
          )}
        >
          Job work register
        </span>
      </div>
    </div>
  );
}

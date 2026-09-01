import { cn } from "@/lib/utils";

// The JC mark. Placeholder until a real logo exists — kept deliberately simple
// so swapping in an SVG later touches only this file.
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-brand font-heading font-bold tracking-tight text-primary-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      JC
    </div>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={32} />
      <span className="font-heading text-base font-semibold tracking-tight text-foreground">
        Jainam Creation
      </span>
    </div>
  );
}

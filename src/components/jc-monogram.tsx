// Placeholder brand mark until a real logo exists. Renders "JC" as a simple
// initials mark. Full branding is Phase 8 — keep this minimal.
import { cn } from "@/lib/utils";

export function JCMonogram({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-brand font-heading font-bold tracking-tight text-primary-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      JC
    </div>
  );
}

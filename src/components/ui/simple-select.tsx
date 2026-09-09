"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = {
  value: string;
  label: string;
  /**
   * Optional colour dot before the label, e.g. `bg-status-pending`. The four
   * job work status hues were defined so those states are tellable apart at a
   * glance; wherever a status is chosen, it should carry its colour.
   */
  dot?: string;
};

/**
 * The one dropdown for the whole app.
 *
 * Replaces the native <select> elements that were scattered around. A native
 * select paints its own arrow hard against the right edge with spacing the
 * page cannot control, so a short value in a wide box left the chevron
 * stranded — and it looked nothing like the Radix Select used on the job work
 * form. This wraps the styled one so every dropdown matches.
 *
 * Radix keeps a hidden native <select name> in sync underneath, so passing
 * `name` still posts into FormData exactly like a plain select. Never pair
 * that with a hidden input mirror — the value would post twice.
 *
 * Width: the trigger hugs its content by default, which puts the chevron
 * right beside the value. Pass `fullWidth` for form fields, where lining up
 * with the inputs around it matters more.
 */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  name,
  id,
  ariaLabel,
  fullWidth = false,
  className,
  disabled,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("h-[42px]", fullWidth && "w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.dot ? (
              <span className="flex items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", o.dot)} aria-hidden="true" />
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

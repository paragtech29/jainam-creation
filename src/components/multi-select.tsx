"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type Option = { id: string; label: string };

/**
 * Searchable, multi-selectable picker. Selections are emitted as hidden
 * inputs so this drops into a plain <form action={serverAction}> without any
 * client-side form library.
 *
 * A native <select multiple> would have been free, but it is genuinely awful
 * on a phone — no search, and ctrl-click semantics that do not exist on touch.
 */
export function MultiSelect({
  name,
  options,
  defaultSelected = [],
  onSelectionChange,
  placeholder,
  searchPlaceholder,
  emptyText,
}: {
  name: string;
  options: Option[];
  defaultSelected?: string[];
  /**
   * Selection lives in React state and is posted through hidden inputs, so
   * nothing user-driven fires on the form when it changes. A form that wants
   * to know (to enable its Save button) has to be told.
   */
  onSelectionChange?: (ids: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [open, setOpen] = useState(false);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      onSelectionChange?.(next);
      return next;
    });

  const chosen = options.filter((o) => selected.includes(o.id));

  return (
    <div className="flex flex-col gap-2">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-left text-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("truncate", chosen.length === 0 && "text-muted-foreground")}>
              {chosen.length === 0
                ? placeholder
                : `${chosen.length} selected`}
            </span>
            <ChevronsUpDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-10" />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const isOn = selected.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.label}
                      onSelect={() => toggle(o.id)}
                      className="min-h-10 cursor-pointer"
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-sm border",
                          isOn ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        )}
                        aria-hidden="true"
                      >
                        {isOn ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      {o.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((o) => (
            <Badge key={o.id} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
              {o.label}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-label={`Remove ${o.label}`}
                className="flex size-4 items-center justify-center rounded-full transition-colors hover:bg-foreground/10"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

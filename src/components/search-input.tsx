"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Search lives in the URL, so a refresh keeps the same view and the page can
// be bookmarked. Debounced so a slow connection isn't hit on every keystroke.
export function SearchInput({
  placeholder,
  className,
  height = "h-10",
}: {
  placeholder: string;
  // Callers control width and height so the same control works standing
  // alone above a list or sitting inside a filter grid.
  className?: string;
  height?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  const first = useRef(true);

  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);

  // Re-sync when the URL changed from the OUTSIDE — the "Clear search and
  // filters" button, a plain link, or the browser's back button. Without this
  // the box kept its text after any of those, so clearing looked broken: the
  // list reset but "abc" stayed sitting in the input.
  //
  // Adjusting state during render (rather than in an effect) is the
  // documented React pattern for this, and this project's ESLint forbids
  // setState inside an effect anyway.
  //
  // Comparing against `value` is what distinguishes an outside change from
  // the echo of our own debounced push: the timeout below is cleared on every
  // keystroke, so a push only ever happens once typing has settled, at which
  // point the URL and `value` already agree. A mid-typing rewind therefore
  // cannot happen — which is why no ref is needed here (and refs must not be
  // read during render).
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== value.trim()) setValue(urlQuery);
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const trimmed = value.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      next.delete("page"); // a new search always starts at page 1
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "w-full rounded-[10px] border border-input bg-card pl-9 pr-9 text-[13.5px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          height
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

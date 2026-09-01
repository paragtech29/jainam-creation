"use client";

// Repeating description-line rows: each row is a type dropdown plus a typed
// price. Rows post as TWO same-named FormData arrays — every row's <Select
// name="descriptionTypeId"> and <Input name="price"> share identical names
// across all rows, never indexed names like descriptionTypeId[0]. The server
// (actions.ts's readDescriptionLines) reads both with formData.getAll() and
// zips them by index, relying on same-named inputs posting in DOM order.
// This works ONLY as long as every row keeps a stable identity independent
// of its position, so removing a middle row actually removes that row's DOM
// node rather than React reusing it for a different logical row — hence
// `key={row.key}` (a fresh id at row creation), never the array
// index. If a future refactor renames these fields to
// `descriptionTypeId[0]`-style indexed names, the server's getAll-then-zip
// pairing breaks silently and a price can land against the wrong kind of
// work — do not do that without also rewriting the server read.
//
// Per 03-01-SUMMARY's confirmed Select posting contract: <Select name="...">
// posts natively via Radix's hidden mirrored native <select>. Do NOT add a
// paired <input type="hidden" name="descriptionTypeId" /> — that would post
// every value twice and misalign every row against its price.
// createId, NOT crypto.randomUUID. randomUUID only exists in a secure
// context — it works on localhost and HTTPS but throws on a plain-http LAN
// address like http://192.168.1.5:3000, which is exactly how the owner opens
// this app from his phone. cuid2 is already a dependency and has no such
// requirement.
import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineDescriptionTypeForm } from "./inline-description-type-form";

type DescriptionType = { id: string; name: string };
type Row = { key: string; descriptionTypeId: string; price: string };

function newRow(): Row {
  return { key: createId(), descriptionTypeId: "", price: "" };
}

export function DescriptionRows({
  initialRows,
  types,
  onRowsChange,
  error,
}: {
  initialRows?: { descriptionTypeId: string; price: number }[];
  types: DescriptionType[];
  // Emits the FULL rows, not just prices. The parent needs the type ids to
  // persist a draft — a draft that restores prices but blanks every type
  // would leave the owner re-picking the fiddliest part of the form, which
  // defeats the point of having a draft at all.
  onRowsChange: (rows: { descriptionTypeId: string; price: string }[]) => void;
  error?: string;
}) {
  const [availableTypes, setAvailableTypes] = useState(types);
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length > 0
      ? initialRows.map((r) => ({
          key: createId(),
          descriptionTypeId: r.descriptionTypeId,
          price: String(r.price),
        }))
      : [newRow()]
  );
  const [addingTypeForRow, setAddingTypeForRow] = useState<string | null>(null);

  function emitRows(next: Row[]) {
    onRowsChange(
      next.map((r) => ({ descriptionTypeId: r.descriptionTypeId, price: r.price }))
    );
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((cur) => {
      const next = cur.map((r) => (r.key === key ? { ...r, ...patch } : r));
      emitRows(next);
      return next;
    });
  }

  function addRow() {
    setRows((cur) => [...cur, newRow()]);
  }

  function removeRow(key: string) {
    setRows((cur) => {
      const next = cur.filter((r) => r.key !== key);
      emitRows(next);
      // Never leave the owner with nothing to type into.
      const result = next.length > 0 ? next : [newRow()];
      if (next.length === 0) {
        // The fresh blank row carries no price, so pricing doesn't change,
        // but emit anyway for consistency with the filtered array shown.
        emitRows(result);
      }
      return result;
    });
    if (addingTypeForRow === key) setAddingTypeForRow(null);
  }

  const subtotal = rows
    .map((r) => Number(r.price))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* A bordered table rather than loose rows: the type and its price are
          one record, and the old layout gave the dropdown ~85% of the width
          while the price — the number that decides the rate — got a stub. */}
      <div className="overflow-hidden rounded-[12px] border border-border">
        <div className="grid grid-cols-[1fr_150px_44px] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            Type of work
          </span>
          <span className="text-right text-[11px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
            Price (₹)
          </span>
          <span className="sr-only">Remove</span>
        </div>

        {rows.map((row, i) => (
          <div key={row.key} className="border-b border-border last:border-0">
            <div className="grid grid-cols-[1fr_150px_44px] items-center gap-2 px-3 py-2">
              <Select
                name="descriptionTypeId"
                value={row.descriptionTypeId}
                onValueChange={(v) => {
                  if (v === "__add_new__") {
                    setAddingTypeForRow(row.key);
                    return;
                  }
                  updateRow(row.key, { descriptionTypeId: v });
                }}
              >
                <SelectTrigger className="h-10 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-1">
                  <SelectValue placeholder="Choose work…" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_new__" className="font-medium text-primary">
                    + Add new type
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  name="price"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  placeholder="0"
                  aria-label={`Price for row ${i + 1}`}
                  value={row.price}
                  onChange={(e) => updateRow(row.key, { price: e.target.value })}
                  className="h-10 pl-6 text-right font-mono tabular-nums"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove row ${i + 1}`}
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                className="size-10 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <Trash2 size={15} />
              </Button>
            </div>

            {addingTypeForRow === row.key ? (
              <div className="border-t border-border bg-muted/30 px-3 py-2.5">
                <InlineDescriptionTypeForm
                  onCreated={(t) => {
                    setAvailableTypes((cur) => [...cur, t]);
                    updateRow(row.key, { descriptionTypeId: t.id });
                    setAddingTypeForRow(null);
                  }}
                  onCancel={() => setAddingTypeForRow(null)}
                />
              </div>
            ) : null}
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border bg-card py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={15} aria-hidden="true" /> Add row
        </button>
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
        <span className="text-xs text-muted-foreground">
          Rows add up to{" "}
          <strong className="font-mono font-semibold tabular-nums text-foreground">₹{subtotal}</strong>
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

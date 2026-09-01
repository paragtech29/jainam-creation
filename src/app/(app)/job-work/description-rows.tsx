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
// `key={row.key}` (crypto.randomUUID() at row creation), never the array
// index. If a future refactor renames these fields to
// `descriptionTypeId[0]`-style indexed names, the server's getAll-then-zip
// pairing breaks silently and a price can land against the wrong kind of
// work — do not do that without also rewriting the server read.
//
// Per 03-01-SUMMARY's confirmed Select posting contract: <Select name="...">
// posts natively via Radix's hidden mirrored native <select>. Do NOT add a
// paired <input type="hidden" name="descriptionTypeId" /> — that would post
// every value twice and misalign every row against its price.
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
  return { key: crypto.randomUUID(), descriptionTypeId: "", price: "" };
}

export function DescriptionRows({
  initialRows,
  types,
  onPricesChange,
  error,
}: {
  initialRows?: { descriptionTypeId: string; price: number }[];
  types: DescriptionType[];
  onPricesChange: (prices: number[]) => void;
  error?: string;
}) {
  const [availableTypes, setAvailableTypes] = useState(types);
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows && initialRows.length > 0
      ? initialRows.map((r) => ({
          key: crypto.randomUUID(),
          descriptionTypeId: r.descriptionTypeId,
          price: String(r.price),
        }))
      : [newRow()]
  );
  const [addingTypeForRow, setAddingTypeForRow] = useState<string | null>(null);

  function emitPrices(next: Row[]) {
    onPricesChange(
      next
        .map((r) => Number(r.price))
        .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)
    );
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((cur) => {
      const next = cur.map((r) => (r.key === key ? { ...r, ...patch } : r));
      emitPrices(next);
      return next;
    });
  }

  function addRow() {
    setRows((cur) => [...cur, newRow()]);
  }

  function removeRow(key: string) {
    setRows((cur) => {
      const next = cur.filter((r) => r.key !== key);
      emitPrices(next);
      // Never leave the owner with nothing to type into.
      const result = next.length > 0 ? next : [newRow()];
      if (next.length === 0) {
        // The fresh blank row carries no price, so pricing doesn't change,
        // but emit anyway for consistency with the filtered array shown.
        emitPrices(result);
      }
      return result;
    });
    if (addingTypeForRow === key) setAddingTypeForRow(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
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
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Type of work" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    + Add new type
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Input
              name="price"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              placeholder="Price"
              value={row.price}
              onChange={(e) => updateRow(row.key, { price: e.target.value })}
              className="h-11 w-28 tnum"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove row"
              onClick={() => removeRow(row.key)}
              className="h-11 w-11 shrink-0"
            >
              <Trash2 size={16} className="text-muted-foreground" />
            </Button>
          </div>

          {addingTypeForRow === row.key ? (
            <InlineDescriptionTypeForm
              onCreated={(t) => {
                setAvailableTypes((cur) => [...cur, t]);
                updateRow(row.key, { descriptionTypeId: t.id });
                setAddingTypeForRow(null);
              }}
              onCancel={() => setAddingTypeForRow(null)}
            />
          ) : null}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit gap-1.5">
        <Plus size={15} /> Add row
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

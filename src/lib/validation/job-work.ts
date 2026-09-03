// Shared client/server validation schema for the Job Work form (money layer).
// Used identically by the client form and the Server Actions (03-02/03-04/03-05).
import { z } from "zod";

// FormData posting contract for <Select>
// CONFIRMED FROM SOURCE (node_modules/@radix-ui/react-select/dist/index.mjs,
// SelectBubbleInput, ~line 1083): Radix Select's Root renders a hidden native
// <select> (Primitive.select) that receives the `name` prop passed to <Select>
// and is kept in sync via a native "change" event dispatch, so it posts into
// FormData exactly like a plain <select name="...">.
// DECISION: use `<Select name="...">` directly and DO NOT add a paired
// `<input type="hidden" name="..." />` mirror.
// THIS IS LOAD-BEARING: doing BOTH would post each value TWICE, and
// `formData.getAll("descriptionTypeId")` would then return 2N entries and
// silently misalign every description row against its price. Do not add a
// hidden-input mirror next to any <Select name="...">.

export const digitsOnly = z.string().trim().regex(/^[0-9]*$/, "Digits only");
// used for chalanNo, partyDesignNo, computerDesignNo. Empty string is VALID
// (all three are optional). These stay TEXT columns in the DB.

export const descriptionLineSchema = z.object({
  descriptionTypeId: z.string().min(1, "Choose a type"),
  price: z
    .string()
    .trim()
    .min(1, "Price is required")
    .pipe(z.coerce.number<string>().int("Whole rupees only").positive("Price must be more than 0")),
});

export const jobWorkSchema = z.object({
  date: z.string().min(1, "Please choose a date"),
  partyId: z.string().min(1, "Please choose a party"),
  karigarId: z.string().min(1, "Please choose a silai karigar"),
  pieces: z
    .string()
    .trim()
    .min(1, "Please enter the number of pieces")
    .pipe(z.coerce.number<string>().int().positive("Pieces must be more than 0")),
  rate: z
    .string()
    .trim()
    .min(1, "Please enter a rate")
    .pipe(z.coerce.number<string>().int("Whole rupees only").positive("Rate must be more than 0")),
  chalanNo: digitsOnly.optional().or(z.literal("")),
  partyDesignNo: digitsOnly.optional().or(z.literal("")),
  computerDesignNo: digitsOnly.optional().or(z.literal("")),
  comment: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
  isBilled: z.coerce.boolean().optional(),
  lines: z.array(descriptionLineSchema).min(1, "Please add at least one description line"),
});

export type JobWorkInput = z.infer<typeof jobWorkSchema>;

// computeTotal is the ONLY place a job work's total is derived. Both inputs
// are already-validated integers by the time this is called. Integer
// multiplication only — never float, never Decimal. Verified against the
// owner's real book: 126 x 162 = 20412, 112 x 198 = 22176, 459 x 155 = 71145.
export function computeTotal(pieces: number, rate: number): number {
  return pieces * rate;
}

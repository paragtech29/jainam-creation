// Shared client/server validation for a description type — the kinds of work
// that appear on a job work's description lines (Galu, Sleeve, Dupatta...).
//
// No price field: the price is typed per job work, because the same work is
// charged differently to different parties. The figure used is snapshotted
// onto jobWorkDescriptions.priceUsed at save time.
import { z } from "zod";

export const descriptionTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  // Duplicate names are BLOCKED, not warned — enforced by the
  // (userId, name) unique index. There is only ever one "Galu", unlike
  // parties, where two real businesses can genuinely share a name.
});

export type DescriptionTypeInput = z.infer<typeof descriptionTypeSchema>;

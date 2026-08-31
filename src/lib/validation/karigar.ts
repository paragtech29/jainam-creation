// Shared client/server validation schema for the Silai Karigar master.
import { z } from "zod";

export const karigarSchema = z.object({
  name: z.string().trim().min(1, "Karigar name is required"),
  address: z.string().trim().optional().or(z.literal("")),
  contact1: z.string().trim().optional().or(z.literal("")),
  contact2: z.string().trim().optional().or(z.literal("")),
  // Warn-but-allow duplicate-name resubmit flag — see 02-RESEARCH.md.
  confirmDuplicate: z.coerce.boolean().optional(),
  // NOTE: partyIds is deliberately NOT part of this schema. The karigar
  // create form's party picker submits repeated `partyIds` form fields,
  // which `Object.fromEntries(formData)` collapses to a single value. The
  // Server Action reads them separately via `formData.getAll("partyIds")`,
  // outside this schema's parse. Do not "fix" this by adding partyIds here.
});

export type KarigarInput = z.infer<typeof karigarSchema>;

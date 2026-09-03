// Shared client/server validation schema for the Silai Karigar master.
// Field rules live in ./common — same definitions the party form uses.
import { z } from "zod";
import { optionalPhone, optionalText, personName } from "./common";

export const karigarSchema = z.object({
  // A karigar is a person, so the same rule as an owner name: no digits.
  name: personName("Karigar name"),

  // Left OPTIONAL deliberately. The owner asked for a required contact on
  // parties, not on karigars — he may well take maal from someone whose
  // number he does not have yet. The FORMAT is still enforced when a value
  // is given, which was the actual bug: a contact accepted letters.
  contact1: optionalPhone("Contact 1"),
  contact2: optionalPhone("Contact 2"),

  address: optionalText("Address"),

  // Warn-but-allow duplicate-name resubmit flag — see 02-RESEARCH.md.
  confirmDuplicate: z.coerce.boolean().optional(),
  // NOTE: partyIds is deliberately NOT part of this schema. The party picker
  // submits repeated `partyIds` fields, which `Object.fromEntries(formData)`
  // collapses to a single value. The Server Action reads them separately via
  // `formData.getAll("partyIds")`. Do not "fix" this by adding partyIds here.
});

export type KarigarInput = z.infer<typeof karigarSchema>;

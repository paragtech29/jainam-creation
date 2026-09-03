// Shared client/server validation schema for the Silai Karigar master.
// Field rules live in ./common — same definitions the party form uses.
import { z } from "zod";
import { distinctPair, optionalPhone, optionalText, personName } from "./common";

export const karigarSchema = z.object({
  // A karigar is a person, so the same rule as an owner name: no digits.
  name: personName("Karigar name"),

  // Left OPTIONAL deliberately. The owner asked for a required contact on
  // parties, not on karigars — he may well take maal from someone whose
  // number he does not have yet. The FORMAT is still enforced when a value
  // is given, which was the actual bug: a contact accepted letters.
  contact1: optionalPhone("Mobile number"),
  contact2: optionalPhone("Alternate number"),

  address: optionalText("Address"),

  // Warn-but-allow duplicate-NAME resubmit flag. Unlike a party, two karigars
  // can genuinely share a name, so this stays a warning.
  confirmDuplicate: z.coerce.boolean().optional(),

  // NOTE: partyIds is deliberately NOT part of this schema. The party picker
  // submits repeated `partyIds` fields, which `Object.fromEntries(formData)`
  // collapses to a single value. The Server Action reads them separately via
  // `formData.getAll("partyIds")`. Do not "fix" this by adding partyIds here.
}).superRefine((v, ctx) => {
  distinctPair(ctx, v.contact1, v.contact2, "contact2",
    "Alternate number must be different from the mobile number");
});

export type KarigarInput = z.infer<typeof karigarSchema>;

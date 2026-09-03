// Shared client/server validation schema for the Party master.
// Field rules live in ./common so party, karigar and job work agree on what a
// name and a phone number are.
import { z } from "zod";
import {
  businessName,
  optionalPersonName,
  optionalPhone,
  optionalText,
  personName,
  phone,
} from "./common";

export const partySchema = z.object({
  // Business name: digits allowed ("3 Star Creation"), but not digits alone.
  name: businessName("Party name"),

  // A person's name — no digits.
  ownerName1: personName("Owner name 1"),
  ownerName2: optionalPersonName("Owner name 2"),

  // Required, per the owner: a party you cannot ring is not much use.
  contact1: phone("Contact 1"),
  contact2: optionalPhone("Contact 2"),

  // Required. "unspecified" is the sentinel the Radix Select sends for no
  // answer — it is deliberately NOT accepted here, which is what makes the
  // field mandatory.
  gender: z.enum(["male", "female", "other"], {
    message: "Choose a gender",
  }),

  address: optionalText("Address"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),

  // Warn-but-allow duplicate-name resubmit flag — see 02-RESEARCH.md.
  confirmDuplicate: z.coerce.boolean().optional(),
});

export type PartyInput = z.infer<typeof partySchema>;

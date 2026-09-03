// Shared client/server validation schema for the Party master.
// Field rules live in ./common so party, karigar and job work agree on what a
// name and a phone number are.
import { z } from "zod";
import {
  businessName,
  distinctPair,
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
  ownerName1: personName("Owner name"),
  ownerName2: optionalPersonName("Co-owner name"),

  // Required, per the owner: a party you cannot ring is not much use.
  contact1: phone("Mobile number"),
  contact2: optionalPhone("Alternate number"),

  // Required. "unspecified" is the sentinel the Radix Select sends for no
  // answer — it is deliberately NOT accepted here, which is what makes the
  // field mandatory.
  gender: z.enum(["male", "female", "other"], {
    message: "Please choose a gender",
  }),

  address: optionalText("Address"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),

}).superRefine((v, ctx) => {
  // A co-owner is a SECOND person. Naming the same person twice was accepted
  // before, which made the field pointless.
  distinctPair(ctx, v.ownerName1, v.ownerName2, "ownerName2",
    "Co-owner must be a different person from the owner");
  distinctPair(ctx, v.contact1, v.contact2, "contact2",
    "Alternate number must be different from the mobile number");
});

export type PartyInput = z.infer<typeof partySchema>;

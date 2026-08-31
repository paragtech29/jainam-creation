// Shared client/server validation schema for the Party master.
import { z } from "zod";

export const partySchema = z.object({
  name: z.string().trim().min(1, "Party name is required"),
  ownerName1: z.string().trim().min(1, "Owner name 1 is required"),
  ownerName2: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  contact1: z.string().trim().optional().or(z.literal("")),
  contact2: z.string().trim().optional().or(z.literal("")),
  // Warn-but-allow duplicate-name resubmit flag — see 02-RESEARCH.md.
  confirmDuplicate: z.coerce.boolean().optional(),
});

export type PartyInput = z.infer<typeof partySchema>;

// Shared client/server validation schema for the Particular master.
import { z } from "zod";

export const particularSchema = z.object({
  name: z.string().trim().min(1, "Particular name is required"),
  // FormData always yields strings. The z.string() guard before .pipe() is
  // deliberate — do NOT simplify to a bare z.coerce.number(), which would
  // silently coerce "" to 0 instead of reporting "Price is required".
  defaultPrice: z
    .string()
    .trim()
    .min(1, "Price is required")
    .pipe(z.coerce.number<string>().int("Price must be a whole number of rupees").nonnegative("Price cannot be negative")),
  // No confirmDuplicate here — duplicate particular names are BLOCKED
  // (DB-level uniqueIndex "particulars_user_name_unique"), not warned.
  // This divergence from parties/karigars is a locked user decision.
});

export type ParticularInput = z.infer<typeof particularSchema>;

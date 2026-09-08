// Shared client/server validation schemas for auth flows.
// Keep this file free of any database or bcrypt import — it must be safe
// to import into a client component (the login and change-password forms).
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    // The three rules the settings screen shows as a live checklist. They are
    // enforced HERE, not only in the UI: a checklist that ticks rules the
    // server does not check is decoration, and one that blocks on rules the
    // server does not have is a policy invented by a component. The
    // password-reset script deliberately bypasses this - it is the lockout
    // escape hatch and must keep working whatever the policy becomes.
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .refine((v) => /[a-zA-Z]/.test(v), "New password needs at least one letter")
      .refine((v) => /[0-9]/.test(v), "New password needs at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

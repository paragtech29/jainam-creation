"use server";

import bcrypt from "bcryptjs";
import { getCurrentUserId } from "@/lib/session";
import { getUserById, updatePasswordHash } from "@/lib/db/repositories/users";
import { changePasswordSchema } from "@/lib/validation/auth";

export type ChangePasswordState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<"oldPassword" | "newPassword" | "confirmPassword", string>>;
      success?: boolean;
    }
  | undefined;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  // The user id comes from the session ONLY — never from a hidden form
  // field or URL parameter (see docs/DATA-ACCESS.md).
  const userId = await getCurrentUserId();

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Please check the fields and try again.",
      fieldErrors: {
        oldPassword: flattened.oldPassword?.[0],
        newPassword: flattened.newPassword?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      },
    };
  }
  const { oldPassword, newPassword } = parsed.data;

  const user = await getUserById(userId);
  if (!user) return { error: "User not found." };

  // Promise form only (no callback) — see 01-RESEARCH.md Pitfall 7.
  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const newHash = await bcrypt.hash(newPassword, 10);
  await updatePasswordHash(userId, newHash);

  // JWT sessions cannot be individually revoked server-side (there is no
  // session table to delete from). At one user this is an accepted
  // tradeoff: the existing session simply stays valid until its natural
  // maxAge/updateAge expiry, since the same person changed the password.
  // Do NOT build a JWT blocklist — that is exactly the over-engineering
  // the zero-budget, one-user constraint rules out.
  return { success: true };
}

"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Incorrect username or password." };
  }

  try {
    await signIn("credentials", {
      username: parsed.data.username,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws a NEXT_REDIRECT error on SUCCESS — that must be
    // re-thrown so Next.js can perform the redirect. Only genuine
    // credential failures should be converted into a form error.
    if (isRedirectError(error)) throw error;

    if (error instanceof AuthError) {
      return { error: "Incorrect username or password." };
    }

    return { error: "Incorrect username or password." };
  }

  return undefined;
}

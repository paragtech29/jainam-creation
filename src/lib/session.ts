// The ONLY sanctioned way server code obtains a userId. Never read a userId
// from a form field or URL parameter — always go through this helper, which
// derives it from the verified session.
import { auth } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

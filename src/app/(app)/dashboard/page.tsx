import { getCurrentUserId } from "@/lib/session";
import { getUserById } from "@/lib/db/repositories/users";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const user = await getUserById(userId);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">
        {user ? `Welcome, ${user.username}` : "Welcome"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re signed in. Parties, karigars and job works arrive in the
        next phases.
      </p>
    </div>
  );
}

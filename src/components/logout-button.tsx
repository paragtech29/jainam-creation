import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export function LogoutButton() {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={logout}>
      <Button type="submit" variant="ghost">
        Log out
      </Button>
    </form>
  );
}

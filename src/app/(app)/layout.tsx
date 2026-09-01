import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getUserById } from "@/lib/db/repositories/users";
import { signOut } from "@/lib/auth";
import { BrandLockup } from "@/components/brand-mark";
import { NavLinks } from "@/components/nav-link";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import { PageTitle } from "@/components/page-title";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt-and-braces check in case the proxy matcher is ever misconfigured.
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    redirect("/login");
  }

  const user = await getUserById(userId);
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Full-height sidebar sits beside the header, rather than under a
          full-width top bar — navigation stays put regardless of scroll. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLockup />
        </div>
        <div className="flex-1 p-3">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-6">
          <MobileNav />
          <div className="lg:hidden">
            <BrandLockup className="[&>span]:hidden sm:[&>span]:inline" />
          </div>
          <div className="hidden lg:block">
            <PageTitle />
          </div>
          <div className="ml-auto">
            <UserMenu username={user.username} logoutAction={logout} />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getUserById } from "@/lib/db/repositories/users";
import { signOut } from "@/lib/auth";
import { BrandLockup } from "@/components/brand-mark";
import { NavLinks } from "@/components/nav-link";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarProfile } from "@/components/sidebar-profile";
import { PageHeaderBar } from "@/components/page-header-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const profile = <SidebarProfile username={user.username} logoutAction={logout} />;

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="sticky top-0 hidden h-svh w-[238px] shrink-0 flex-col gap-6 bg-sidebar p-[20px_14px] lg:flex">
        <BrandLockup onDark />
        <NavLinks />
        {profile}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeaderBar mobileNav={<MobileNav profile={profile} />} />

        <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-[22px] pb-[22px] pt-[22px]">
          {children}
        </main>
      </div>
    </div>
  );
}

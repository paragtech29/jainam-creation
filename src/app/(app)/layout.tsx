import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getUserById } from "@/lib/db/repositories/users";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
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

  const [user, parties, karigars] = await Promise.all([
    getUserById(userId),
    listParties(userId),
    listKarigars(userId),
  ]);
  if (!user) redirect("/login");

  // Counts ride along in the nav so the owner can see the shape of his data
  // without opening anything.
  const counts = {
    "/parties": parties.length,
    "/karigars": karigars.length,
  };

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const profile = <SidebarProfile username={user.username} logoutAction={logout} />;

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-[238px] shrink-0 flex-col gap-6 bg-sidebar p-[20px_14px] lg:flex">
        <BrandLockup onDark />
        <NavLinks counts={counts} />
        {profile}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeaderBar mobileNav={<MobileNav counts={counts} profile={profile} />} />

        <main className="w-full max-w-[1360px] flex-1 px-[22px] pb-20 pt-[22px]">
          {children}
        </main>
      </div>
    </div>
  );
}

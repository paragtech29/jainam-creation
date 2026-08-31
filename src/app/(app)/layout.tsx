import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { JCMonogram } from "@/components/jc-monogram";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt-and-braces check in case the proxy matcher is ever misconfigured.
  try {
    await getCurrentUserId();
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <JCMonogram size={32} />
          <span className="truncate text-sm font-medium">Jainam Creation</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/settings"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

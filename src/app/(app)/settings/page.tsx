import { Download, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getUserById } from "@/lib/db/repositories/users";
import { signOut } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

// Already session-protected by proxy.ts + the (app) layout's session check —
// the user is read here only to name the account, not to guard the page.
export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  const user = await getUserById(userId);
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Two columns on a wide screen, stacked on a phone. The password card
          is the wider one: it is the only thing on this screen you actually
          fill in, and it was previously squeezed into a 384px column with a
          full-width button, which made a five-field form look like a login
          box. */}
      <div className="grid max-w-[1100px] items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] xl:[grid-template-columns:minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[15px] border border-border bg-card">
          <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
            <span className="text-[15px] font-semibold tracking-tight">Change password</span>
            {/* States the consequence up front. JWT sessions cannot be revoked
                server-side, so a password change does NOT sign other devices
                out — better said here than discovered. */}
            <span className="text-[12.5px] text-muted-foreground">
              You will stay signed in on this device, and on any other device already signed in.
            </span>
          </div>
          <ChangePasswordForm />
        </section>

        <div className="flex min-w-0 flex-col gap-3.5">
          {/* This is the backup. There is no database console in this app and
              no intention of adding one, so one click producing one file is
              the only backup that will actually get taken. It includes the
              karigar-party links, without which the export could not rebuild
              who sews for whom. */}
          <section className="flex flex-col gap-3 rounded-[15px] border border-border bg-card p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent text-accent-foreground">
                <Download size={19} aria-hidden="true" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">Download all data</span>
            </div>
            <p className="text-[13px] leading-relaxed text-secondary-foreground">
              One Excel file with every job work, party, silai karigar and description type — plus
              which karigars work for which parties. Keep it somewhere safe; it is your backup.
            </p>
            <a
              href="/api/export/everything"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download size={15} aria-hidden="true" />
              Download Excel backup
            </a>
          </section>

          <section className="flex flex-col gap-3 rounded-[15px] border border-border bg-card p-5">
            <span className="text-[15px] font-semibold tracking-tight">Account</span>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[14.5px] font-semibold">{user.username}</span>
                <span className="text-[12.5px] text-muted-foreground">Owner · full access</span>
              </div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-input bg-card px-4 text-[13.5px] font-medium text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

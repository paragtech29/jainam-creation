import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { ChangePasswordForm } from "./change-password-form";

// Already session-protected by proxy.ts + the (app) layout's session check —
// no extra guard needed here. The only setting in v1 is the password.
export default function SettingsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* This is the backup. There is no database console in this app and no
          intention of adding one, so one click producing one file is the only
          backup that will actually get taken. It includes the karigar-party
          links, without which the export could not rebuild who sews for
          whom. */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Download all data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            One Excel file with every job work, party, silai karigar and
            description type — plus which karigars work for which parties.
            Keep it somewhere safe; it is your backup.
          </p>
          <a
            href="/api/export/everything"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download size={15} aria-hidden="true" />
            Download Excel backup
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

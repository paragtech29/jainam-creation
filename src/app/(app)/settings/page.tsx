import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

// Already session-protected by proxy.ts + the (app) layout's session check —
// no extra guard needed here. The only setting in v1 is the password.
export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

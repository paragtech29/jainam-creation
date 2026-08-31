import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JCMonogram } from "@/components/jc-monogram";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <JCMonogram size={56} />
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">Jainam Creation</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

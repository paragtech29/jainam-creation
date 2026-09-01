import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel is hidden on phones rather than squeezed into a banner —
          on a small screen the form should own the whole viewport. */}
      <section className="login-brand-panel hidden flex-col justify-between p-12 lg:flex">
        <div className="relative flex items-center gap-3">
          <BrandMark size={36} className="bg-white/15 backdrop-blur-sm" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Jainam Creation
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">
            Your job work book, always with you.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Every party, every karigar, every chalan — recorded the moment you
            take the maal, and totalled for you at the end of the month.
          </p>
        </div>

        <p className="relative text-xs text-white/50">
          &copy; {new Date().getFullYear()} Jainam Creation
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <BrandMark size={48} />
            <span className="font-heading text-lg font-semibold tracking-tight">
              Jainam Creation
            </span>
          </div>

          <div className="rounded-lg border border-border bg-card p-8 shadow-card">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to manage your job work records.
              </p>
            </div>

            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            &copy; {new Date().getFullYear()} Jainam Creation
          </p>
        </div>
      </section>
    </div>
  );
}

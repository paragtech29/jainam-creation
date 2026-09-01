import Link from "next/link";
import { Building2, Scissors, ClipboardList, ArrowRight } from "lucide-react";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [parties, karigars] = await Promise.all([
    listParties(userId),
    listKarigars(userId),
  ]);

  const cards = [
    {
      title: "Parties",
      count: parties.length,
      href: "/parties",
      icon: Building2,
      hint: "Businesses who give you work",
    },
    {
      title: "Silai Karigar",
      count: karigars.length,
      href: "/karigars",
      icon: Scissors,
      hint: "Who you collect the maal from",
    },
    {
      title: "Job Work",
      count: 0,
      href: "/job-work",
      icon: ClipboardList,
      hint: "Coming next",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly income and per-party earnings will appear here once job works
          are being recorded.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, count, href, icon: Icon, hint }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-md bg-accent">
                <Icon size={18} className="text-brand" aria-hidden="true" />
              </div>
              <ArrowRight
                size={16}
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </div>
            <p className="mt-4 font-heading text-2xl font-semibold tabular-nums">{count}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

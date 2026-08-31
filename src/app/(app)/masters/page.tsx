import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
import { listParticulars } from "@/lib/db/repositories/particulars";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function MastersPage() {
  const userId = await getCurrentUserId();

  const [parties, karigars, particulars] = await Promise.all([
    listParties(userId),
    listKarigars(userId),
    listParticulars(userId),
  ]);

  const registers = [
    { title: "Parties", href: "/masters/parties", count: parties.length },
    { title: "Karigars", href: "/masters/karigars", count: karigars.length },
    { title: "Particulars", href: "/masters/particulars", count: particulars.length },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-heading text-xl font-medium text-foreground">Masters</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The registers every job work entry draws from.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {registers.map((register) => (
          <Link
            key={register.href}
            href={register.href}
            className="block min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="font-medium">{register.title}</CardTitle>
                <CardDescription>
                  <span className="tnum">{register.count}</span> active
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

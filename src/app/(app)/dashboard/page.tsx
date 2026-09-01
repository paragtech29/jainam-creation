import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listParties } from "@/lib/db/repositories/parties";
import { listKarigars } from "@/lib/db/repositories/karigars";
import { listJobWorksPage } from "@/lib/db/repositories/jobWorks";

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  const [parties, karigars, jobs] = await Promise.all([
    listParties(userId),
    listKarigars(userId),
    // Everything, so the month figures are computed from real rows rather
    // than a sampled page. Fine at this scale; Phase 6 moves the aggregation
    // into SQL when the dashboard gets its real month picker.
    listJobWorksPage(userId, { page: 1, pageSize: 1000 }),
  ]);

  const rows = jobs.rows;
  const now = new Date();
  const inThisMonth = rows.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const monthTotal = inThisMonth.reduce((sum, r) => sum + r.total, 0);
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const unbilled = rows.filter((r) => r.status === "COMPLETED" && !r.isBilled);
  const unbilledTotal = unbilled.reduce((sum, r) => sum + r.total, 0);

  const tiles = [
    { label: "This month", value: inr(monthTotal), note: `${inThisMonth.length} job ${inThisMonth.length === 1 ? "work" : "works"}` },
    { label: "Pending", value: String(pendingCount), note: "not started yet" },
    { label: "Completed, not billed", value: inr(unbilledTotal), note: `${unbilled.length} to invoice`, warn: unbilled.length > 0 },
    { label: "Parties", value: String(parties.length), note: `${karigars.length} karigars` },
  ];

  // Per-party earnings this month, biggest first — the question he asked for
  // at the very start: "how much did I get from Mayra last month".
  const byParty = new Map<string, number>();
  for (const r of inThisMonth) byParty.set(r.partyName, (byParty.get(r.partyName) ?? 0) + r.total);
  const partyBars = [...byParty.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const biggest = partyBars[0]?.amount ?? 0;

  const recent = rows.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(186px,1fr))]">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-[15px_17px]"
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.11em] text-muted-foreground">
              {t.label}
            </span>
            <span className="text-[29px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {t.value}
            </span>
            <span className={t.warn ? "text-xs font-medium text-status-pending" : "text-xs text-muted-foreground"}>
              {t.note}
            </span>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
            <span className="text-[14.5px] font-semibold tracking-tight">Recent job work</span>
            <Link href="/job-work" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">
              Nothing recorded yet.{" "}
              <Link href="/job-work/new" className="font-medium text-primary hover:underline">
                Add your first job work
              </Link>
              .
            </p>
          ) : (
            recent.map((r) => (
              <Link
                key={r.id}
                href={`/job-work/${r.id}`}
                className="flex items-center gap-3 border-b border-border px-[18px] py-3 transition-colors last:border-0 hover:bg-muted/40"
              >
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-xs font-semibold text-accent-foreground">
                  {r.partyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13.5px] font-medium">{r.partyName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.karigarName} · {r.pieces} × ₹{r.rate}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[13px] tabular-nums">{inr(r.total)}</span>
              </Link>
            ))
          )}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
            <span className="text-[14.5px] font-semibold tracking-tight">Work by party</span>
            <span className="text-xs text-muted-foreground">this month</span>
          </div>

          {partyBars.length === 0 ? (
            <p className="px-[18px] py-8 text-center text-sm text-muted-foreground">
              No job works this month yet.
            </p>
          ) : (
            <div className="py-2">
              {partyBars.map((p) => (
                <div key={p.name} className="flex flex-col gap-[7px] px-[18px] py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-secondary-foreground">
                      {inr(p.amount)}
                    </span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${biggest > 0 ? Math.max(4, (p.amount / biggest) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

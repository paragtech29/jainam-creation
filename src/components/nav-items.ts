import { LayoutDashboard, Building2, Scissors, ClipboardList } from "lucide-react";

// The whole navigation, in one place. The sidebar and the mobile drawer both
// read from this, so they can never drift apart.
export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Parties", href: "/parties", icon: Building2 },
  { title: "Silai Karigar", href: "/karigars", icon: Scissors },
  { title: "Job Work", href: "/job-work", icon: ClipboardList },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

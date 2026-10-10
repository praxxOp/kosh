"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import {
  BookOpenCheckIcon,
  HouseIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  WalletIcon,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKosh } from "@/components/kosh/store";

type NavItem = { title: string; href: string; icon: LucideIcon; badge?: "held" | "actions" };
type NavGroup = { title: string; items: NavItem[] };

const navItems: NavGroup[] = [
  {
    title: "Treasury",
    items: [
      { title: "Home", href: "/dashboard/kosh", icon: HouseIcon, badge: "actions" },
      { title: "Inbox", href: "/dashboard/kosh/inbox", icon: MessageSquareIcon }
    ]
  },
  {
    title: "Governance",
    items: [
      { title: "Policy", href: "/dashboard/kosh/policy", icon: BookOpenCheckIcon },
      { title: "Audit log", href: "/dashboard/kosh/audit", icon: ScrollTextIcon },
      { title: "Broker & bank", href: "/dashboard/kosh/broker", icon: WalletIcon, badge: "held" }
    ]
  }
];

export function KoshNav() {
  const pathname = usePathname();
  const { actions, approvals } = useKosh();
  const held = approvals.filter((a) => a.status === "pending").length;

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title}>
          <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {nav.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={pathname === item.href} tooltip={item.title} asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge === "actions" && actions.length > 0 && (
                    <SidebarMenuBadge className="peer-hover/menu-button:text-foreground">{actions.length}</SidebarMenuBadge>
                  )}
                  {item.badge === "held" && held > 0 && (
                    <SidebarMenuBadge className="border border-amber-400 text-amber-600 peer-hover/menu-button:text-amber-600">
                      {held}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

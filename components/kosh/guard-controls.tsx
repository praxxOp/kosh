"use client";

import { useEffect } from "react";
import { BookOpen, CandlestickChart, Check, ChevronsUpDown, Plug, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useKosh } from "./store";
import { ENGINE_LABELS } from "@/lib/kosh/labels";
import { ROLE_LABEL, type Role } from "@/lib/kosh/types";

export function ConnectorPills() {
  const { connectors, loadConnectors } = useKosh();
  useEffect(() => {
    loadConnectors();
    const t = setInterval(loadConnectors, 30_000);
    return () => clearInterval(t);
  }, [loadConnectors]);
  const ICON: Record<string, typeof BookOpen> = { tally: BookOpen, alpaca: CandlestickChart };
  return (
    <div className="hidden items-center gap-2 lg:flex">
      {connectors
        .filter((c) => c.id === "tally" || c.id === "alpaca")
        .map((c) => {
          const Icon = ICON[c.id] ?? Plug;
          return (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <div className="bg-card hover:bg-muted/60 flex h-9 cursor-default items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors">
                  <span className="bg-muted flex size-7 items-center justify-center rounded-full">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-medium">{c.label}</span>
                  </span>
                  <span className={cn("ml-0.5 size-1.5 rounded-full", c.connected ? "bg-green-500" : "bg-muted-foreground/40")} />
                </div>
              </TooltipTrigger>
              <TooltipContent>{c.detail}</TooltipContent>
            </Tooltip>
          );
        })}
    </div>
  );
}

const PEOPLE: { role: Role; name: string; initials: string }[] = [
  { role: "analyst", name: "Kavya Iyer", initials: "KI" },
  { role: "treasury_manager", name: "Arjun Shah", initials: "AS" },
  { role: "cfo", name: "Priya Nair", initials: "PN" },
];

/** Who you are acting as. A people menu in the kit's user-menu style; switching changes what Home and the Inbox show. */
export function RoleMenu() {
  const { role, setRole, running } = useKosh();
  const me = PEOPLE.find((p) => p.role === role)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" disabled={running}>
          <Avatar className="size-7">
            <AvatarFallback className="text-[11px]">{me.initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-start leading-tight sm:block">
            <span className="block text-sm font-medium">{me.name}</span>
            <span className="text-muted-foreground block text-[11px]">{ROLE_LABEL[role]}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Act as</DropdownMenuLabel>
        {PEOPLE.map((p) => (
          <DropdownMenuItem key={p.role} onSelect={() => setRole(p.role)} className="gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{p.initials}</AvatarFallback>
            </Avatar>
            <span className="flex-1 leading-tight">
              <span className="block text-sm font-medium">{p.name}</span>
              <span className="text-muted-foreground block text-xs">{ROLE_LABEL[p.role]}</span>
            </span>
            {p.role === role && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-[11px] font-normal">Acme Pvt Ltd · treasury</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GuardSwitch() {
  const { mode, setMode, running, engine } = useKosh();
  const on = mode === "on";
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "h-7 gap-1.5 rounded-full px-2.5",
          on ? "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400" : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
        )}>
        {on ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
        {on ? `Guard: ${ENGINE_LABELS[engine === "none" ? "local" : engine]}` : "Unguarded"}
        {running && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      </Badge>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch checked={on} onCheckedChange={(c) => setMode(c ? "on" : "off")} disabled={running} />
        <span className="hidden text-xs font-medium sm:inline">Guardrails</span>
      </label>
    </div>
  );
}

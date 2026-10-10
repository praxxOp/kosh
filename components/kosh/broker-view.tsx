"use client";

import * as React from "react";
import { flexRender } from "@tanstack/react-table";
import { type LegacyColumnDef as ColumnDef, getCoreRowModel, getSortedRowModel, useLegacyTable as useReactTable } from "@tanstack/react-table/legacy";
import type { SortingState } from "@tanstack/table-core";
import { Clock, RefreshCw, SearchIcon, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { SortableHeader } from "@/components/table-filter-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/kosh/client";
import { shortTime, usd } from "@/lib/kosh/labels";
import { ROLE_LABEL, type Approval, type Role } from "@/lib/kosh/types";
import { useKosh } from "./store";

interface Order {
  id: string;
  symbol: string;
  side: string;
  qty?: string;
  notional?: string;
  status: string;
  submittedAt: string;
  /** Set on a proposal that is still with a person rather than the broker. */
  approver?: Role;
}

/** Held orders, shown in the same table as the broker's: a proposal is an order that has not reached Alpaca yet. */
const PROPOSAL_STATUS: Record<Approval["status"], string | undefined> = { draft: "proposal", pending: "awaiting_approval", rejected: "rejected", approved: undefined };
function proposalRows(approvals: Approval[]): Order[] {
  return approvals.flatMap((a) => {
    const status = PROPOSAL_STATUS[a.status];
    if (!status || a.server !== "alpaca" || !a.input.symbol) return [];
    return [
      {
        id: a.id,
        symbol: String(a.input.symbol),
        side: String(a.input.side ?? "buy"),
        notional: a.amountUsd !== undefined ? String(a.amountUsd) : undefined,
        qty: a.input.qty !== undefined ? String(a.input.qty) : undefined,
        status,
        submittedAt: a.createdAt,
        approver: a.approver,
      },
    ];
  });
}
interface BrokerData {
  error?: string;
  account?: { cash: number; buyingPower: number; portfolioValue: number; multiplier: number };
  positions?: { symbol: string; qty: number; marketValue: number; unrealizedPl: number }[];
  orders?: Order[];
  transfers: { id: string; ts: string; to: string; account: string; amount: number }[];
}

const amountOf = (o: Order) => (o.notional ? Number(o.notional) : 0);

function StatusBadge({ o }: { o: Order }) {
  if (o.status === "awaiting_approval")
    return (
      <Badge variant="info">
        <Clock /> Awaiting {o.approver ? ROLE_LABEL[o.approver] : "approval"}
      </Badge>
    );
  if (o.status === "proposal") return <Badge variant="outline">Proposal · not sent</Badge>;
  if (o.status === "filled") return <Badge variant="success">Filled</Badge>;
  if (o.status === "canceled" || o.status === "expired" || o.status === "rejected") return <Badge variant="secondary" className="capitalize">{o.status}</Badge>;
  return <Badge variant="warning">{o.status.replace(/_/g, " ")}</Badge>;
}

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "submittedAt",
    header: ({ column }) => <SortableHeader column={column}>Time</SortableHeader>,
    cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{shortTime(row.original.submittedAt)}</span>,
  },
  {
    accessorKey: "symbol",
    header: ({ column }) => <SortableHeader column={column}>Symbol</SortableHeader>,
    cell: ({ row }) => <span className="font-medium">{row.original.symbol}</span>,
  },
  {
    accessorKey: "side",
    header: "Side",
    cell: ({ row }) => <span className="capitalize">{row.original.side}</span>,
  },
  {
    id: "amount",
    accessorFn: amountOf,
    header: ({ column }) => <SortableHeader column={column}>Amount</SortableHeader>,
    cell: ({ row }) => <span className="tabular-nums">{row.original.notional ? usd(amountOf(row.original)) : `${row.original.qty} sh`}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge o={row.original} />,
  },
];

const OPEN = new Set(["new", "accepted", "pending_new", "partially_filled", "accepted_for_bidding", "held", "awaiting_approval", "proposal"]);
const CLOSED = new Set(["canceled", "expired", "rejected"]);

export function BrokerView() {
  const [data, setData] = React.useState<BrokerData | undefined>();
  const [filter, setFilter] = React.useState<"all" | "open" | "filled" | "canceled">("all");
  const [q, setQ] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "submittedAt", desc: true }]);

  const { approvals, loadApprovals } = useKosh();

  const load = React.useCallback(() => {
    loadApprovals();
    return api<BrokerData>("/api/broker").then(setData).catch((e) => toast.error(e.message));
  }, [loadApprovals]);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Proposals first: they are the newest and the ones someone still has to act on.
  const rows = React.useMemo(() => {
    const list = [...proposalRows(approvals), ...(data?.orders ?? [])];
    const needle = q.trim().toLowerCase();
    return list
      .filter((o) => (filter === "all" ? true : filter === "open" ? OPEN.has(o.status) : filter === "filled" ? o.status === "filled" : CLOSED.has(o.status)))
      .filter((o) => !needle || `${o.symbol} ${o.side} ${o.status.replace(/_/g, " ")}`.toLowerCase().includes(needle));
  }, [data, approvals, filter, q]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const orders = data?.orders ?? [];
  const openOrders = orders.filter((o) => OPEN.has(o.status));
  const queued = openOrders.reduce((s, o) => s + amountOf(o), 0);
  const awaiting = approvals.filter((x) => x.status === "pending").length;
  const a = data?.account;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Broker & bank</h1>
          <p className="text-muted-foreground text-sm">Live view of the Alpaca paper account and every order the agent has placed.</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {data?.error && <div className="text-destructive rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">{data.error}</div>}

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Cash</CardTitle>
              <CardAction>
                <Badge variant="secondary">Paper</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl lg:text-3xl">{a ? usd(a.cash) : "—"}</div>
              <p className="text-muted-foreground mt-1 text-xs">the deployable pool</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Portfolio value</CardTitle>
              <CardAction>
                <Badge variant="success">
                  <TrendingUp />
                  {data.positions?.length ?? 0} positions
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl lg:text-3xl">{a ? usd(a.portfolioValue) : "—"}</div>
              <p className="text-muted-foreground mt-1 text-xs">cash plus holdings at market</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Queued orders</CardTitle>
              <CardAction>
                <Badge variant={openOrders.length ? "warning" : "secondary"}>{openOrders.length} open</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl lg:text-3xl">{usd(queued)}</div>
              <p className="text-muted-foreground mt-1 text-xs">
                waiting for the next US market open{awaiting ? ` · ${awaiting} more awaiting approval` : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Buying power</CardTitle>
              <CardAction>
                <Badge variant="destructive">
                  <ShieldCheck />
                  R2 forbids
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl lg:text-3xl">{a ? usd(a.buyingPower) : "—"}</div>
              <p className="text-muted-foreground mt-1 text-xs">{a ? `${a.multiplier}x margin the broker offers; policy caps orders at cash` : ""}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>Market orders outside US hours are accepted and queued for the next open.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="filled">Filled</TabsTrigger>
                <TabsTrigger value="canceled">Canceled</TabsTrigger>
              </TabsList>
            </Tabs>
            <InputGroup className="w-52">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search orders..." value={q} onChange={(e) => setQ(e.target.value)} />
            </InputGroup>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                    {data ? "No orders match." : "Loading…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

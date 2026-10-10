import { z } from "zod";
import type { ToolDef } from "./types";

/**
 * Thin wrappers over the Alpaca REST API. Paper trading by default.
 * Docs: https://docs.alpaca.markets/reference
 */

const TRADING_BASE = () =>
  process.env.ALPACA_PAPER === "false" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets";
const DATA_BASE = "https://data.alpaca.markets";

function headers() {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_SECRET_KEY;
  if (!key || !secret) throw new Error("ALPACA_API_KEY / ALPACA_SECRET_KEY are not set");
  return { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, "content-type": "application/json" };
}

async function alpaca<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) }, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const isCrypto = (symbol: string) => symbol.includes("/");

export async function getAccount() {
  const a = await alpaca<Record<string, string>>(TRADING_BASE(), "/v2/account");
  return {
    id: a.id,
    status: a.status,
    currency: a.currency,
    cash: Number(a.cash),
    buyingPower: Number(a.buying_power),
    portfolioValue: Number(a.portfolio_value),
    multiplier: Number(a.multiplier),
  };
}

export async function getLatestPrice(symbol: string): Promise<{ symbol: string; price: number; source: string }> {
  if (isCrypto(symbol)) {
    const d = await alpaca<{ trades: Record<string, { p: number }> }>(
      DATA_BASE,
      `/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`,
    );
    return { symbol, price: d.trades[symbol].p, source: "crypto latest trade" };
  }
  const d = await alpaca<{ trade: { p: number } }>(DATA_BASE, `/v2/stocks/${symbol}/trades/latest?feed=iex`);
  return { symbol, price: d.trade.p, source: "latest trade (IEX)" };
}

export async function getBars(symbol: string, days = 35) {
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  if (isCrypto(symbol)) {
    const d = await alpaca<{ bars: Record<string, { t: string; c: number }[]> }>(
      DATA_BASE,
      `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=1Day&start=${start}`,
    );
    return d.bars[symbol] ?? [];
  }
  const d = await alpaca<{ bars: { t: string; c: number }[] | null }>(
    DATA_BASE,
    `/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&feed=iex&limit=1000`,
  );
  return d.bars ?? [];
}

export async function getPositions() {
  const p = await alpaca<Record<string, string>[]>(TRADING_BASE(), "/v2/positions");
  return p.map((x) => ({ symbol: x.symbol, qty: Number(x.qty), marketValue: Number(x.market_value), unrealizedPl: Number(x.unrealized_pl) }));
}

export async function getOrders(status: "open" | "closed" | "all" = "all") {
  const o = await alpaca<Record<string, string>[]>(TRADING_BASE(), `/v2/orders?status=${status}&limit=20&direction=desc`);
  return o.map((x) => ({
    id: x.id,
    symbol: x.symbol,
    side: x.side,
    qty: x.qty,
    notional: x.notional,
    type: x.type,
    status: x.status,
    submittedAt: x.submitted_at,
    filledAvgPrice: x.filled_avg_price,
  }));
}

async function placeOrder(args: { symbol: string; notional?: number; qty?: number; side: "buy" | "sell" }) {
  const crypto = isCrypto(args.symbol);
  const body: Record<string, unknown> = {
    symbol: args.symbol,
    side: args.side,
    type: "market",
    time_in_force: crypto ? "gtc" : "day",
  };
  if (args.notional) body.notional = String(args.notional);
  else if (args.qty) body.qty = String(args.qty);
  else throw new Error("notional or qty is required");
  const o = await alpaca<Record<string, string>>(TRADING_BASE(), "/v2/orders", { method: "POST", body: JSON.stringify(body) });
  return { id: o.id, symbol: o.symbol, side: o.side, notional: o.notional, qty: o.qty, status: o.status, submittedAt: o.submitted_at };
}

export const alpacaTools: ToolDef[] = [
  {
    server: "alpaca",
    name: "alpaca_get_account",
    description: "Investment account summary: cash, buying power, portfolio value (USD).",
    inputSchema: z.object({}),
    run: async () => getAccount(),
  },
  {
    server: "alpaca",
    name: "alpaca_get_quote",
    description: "Latest traded price for a stock/ETF symbol (e.g. SGOV) or crypto pair (e.g. BTC/USD).",
    inputSchema: z.object({ symbol: z.string() }),
    run: async ({ symbol }) => getLatestPrice(String(symbol).toUpperCase()),
  },
  {
    server: "alpaca",
    name: "alpaca_get_positions",
    description: "Current holdings in the investment account.",
    inputSchema: z.object({}),
    run: async () => getPositions(),
  },
  {
    server: "alpaca",
    name: "alpaca_get_orders",
    description: "Recent orders and their status.",
    inputSchema: z.object({ status: z.enum(["open", "closed", "all"]).optional() }),
    run: async ({ status }) => getOrders((status as "open" | "closed" | "all" | undefined) ?? "all"),
  },
  {
    server: "alpaca",
    name: "alpaca_place_order",
    description:
      "Place a market order for a stock or ETF. Use notional (USD amount) for dollar-based orders. Orders outside market hours are queued for the next open.",
    inputSchema: z.object({
      symbol: z.string().describe("Ticker, e.g. SGOV"),
      notional: z.number().positive().describe("USD amount to invest"),
      side: z.enum(["buy", "sell"]).default("buy"),
    }),
    run: async ({ symbol, notional, side }) =>
      placeOrder({ symbol: String(symbol).toUpperCase(), notional: Number(notional), side: (side as "buy" | "sell") ?? "buy" }),
  },
  {
    server: "alpaca",
    name: "alpaca_place_crypto_order",
    description: "Place a market order for a crypto pair such as BTC/USD or ETH/USD. Crypto trades 24/7 and fills immediately.",
    inputSchema: z.object({ symbol: z.string().describe("e.g. BTC/USD"), notional: z.number().positive() }),
    run: async ({ symbol, notional }) => placeOrder({ symbol: String(symbol).toUpperCase(), notional: Number(notional), side: "buy" }),
    dangerous: true,
  },
  {
    server: "alpaca",
    name: "alpaca_close_all_positions",
    description: "Liquidate every position in the account.",
    inputSchema: z.object({}),
    run: async () => alpaca(TRADING_BASE(), "/v2/positions?cancel_orders=true", { method: "DELETE" }),
    dangerous: true,
  },
  {
    server: "alpaca",
    name: "alpaca_cancel_all_orders",
    description: "Cancel every open order in the account.",
    inputSchema: z.object({}),
    run: async () => alpaca(TRADING_BASE(), "/v2/orders", { method: "DELETE" }),
    dangerous: true,
  },
];

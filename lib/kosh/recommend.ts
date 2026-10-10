import { getBars, getLatestPrice } from "./tools/alpaca";
import { cashPosition } from "./data/acme";
import { evaluate } from "./policy/rules";
import { getStore } from "./store";

/**
 * Recommendation pipeline: scan live market data, score each instrument,
 * then run every candidate through the treasury policy so the output is
 * "eligible vs excluded (and why)" rather than a raw leaderboard.
 */

const US_UNIVERSE = [
  { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", kind: "T-bill ETF" },
  { symbol: "BIL", name: "SPDR Bloomberg 1-3 Month T-Bill ETF", kind: "T-bill ETF" },
  { symbol: "USFR", name: "WisdomTree Floating Rate Treasury Fund", kind: "T-bill ETF" },
  { symbol: "SHV", name: "iShares Short Treasury Bond ETF", kind: "T-bill ETF" },
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ (3x)", kind: "Leveraged ETF" },
  { symbol: "NVDA", name: "NVIDIA Corp", kind: "Single stock" },
  { symbol: "BTC/USD", name: "Bitcoin", kind: "Crypto" },
];

// Direct-plan growth options of the largest Indian liquid / overnight funds (AMFI scheme codes).
const INDIA_UNIVERSE = [
  { code: 119091, name: "HDFC Liquid Fund", kind: "Liquid" },
  { code: 120197, name: "ICICI Prudential Liquid Fund", kind: "Liquid" },
  { code: 118701, name: "Nippon India Liquid Fund", kind: "Liquid" },
  { code: 119800, name: "SBI Liquid Fund", kind: "Liquid" },
  { code: 119568, name: "Aditya Birla Sun Life Liquid Fund", kind: "Liquid" },
  { code: 120389, name: "Axis Liquid Fund", kind: "Liquid" },
  { code: 119766, name: "Kotak Liquid Fund", kind: "Liquid" },
  { code: 119110, name: "HDFC Overnight Fund", kind: "Overnight" },
  { code: 145536, name: "ICICI Prudential Overnight Fund", kind: "Overnight" },
  { code: 119833, name: "SBI Overnight Fund", kind: "Overnight" },
];

export interface Candidate {
  symbol: string;
  name: string;
  kind: string;
  price?: number;
  return30d?: number; // percent
  annualized?: number; // percent
  volatility?: number; // percent, daily stdev
  score: number;
  eligible: boolean;
  excludedBy?: string;
  note?: string;
}

export interface Recommendation {
  asOf: string;
  spareCashInr: number;
  us: Candidate[];
  india: Candidate[];
  suggestedAllocation: { symbol: string; name: string; pct: number }[];
  notes: string[];
}

let cache: { at: number; value: Recommendation } | undefined;

function stats(closes: number[]) {
  if (closes.length < 5) return undefined;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const r30 = ((last - first) / first) * 100;
  const days = closes.length - 1;
  const annualized = (Math.pow(last / first, 365 / Math.max(days, 1)) - 1) * 100;
  const rets = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * 100;
  return { r30, annualized, vol };
}

async function scanUs(rulesEval: (symbol: string, tool: string) => string | undefined): Promise<{ list: Candidate[]; note?: string }> {
  if (!process.env.ALPACA_API_KEY) return { list: [], note: "Alpaca keys not set; US scan skipped." };
  const list = await Promise.all(
    US_UNIVERSE.map(async (u): Promise<Candidate> => {
      try {
        const [bars, quote] = await Promise.all([getBars(u.symbol, 35), getLatestPrice(u.symbol)]);
        const s = stats(bars.map((b) => b.c));
        const excludedBy = rulesEval(u.symbol, u.symbol.includes("/") ? "alpaca_place_crypto_order" : "alpaca_place_order");
        // Treasury scoring: reward steady annualized yield, punish volatility hard.
        const score = s ? s.annualized - s.vol * 25 : -999;
        return {
          symbol: u.symbol,
          name: u.name,
          kind: u.kind,
          price: quote.price,
          return30d: s?.r30,
          annualized: s?.annualized,
          volatility: s?.vol,
          score,
          eligible: !excludedBy,
          excludedBy,
        };
      } catch (e) {
        return { symbol: u.symbol, name: u.name, kind: u.kind, score: -999, eligible: false, note: (e as Error).message.slice(0, 120) };
      }
    }),
  );
  return { list: list.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score) };
}

async function scanIndia(): Promise<{ list: Candidate[]; note?: string }> {
  const list = await Promise.all(
    INDIA_UNIVERSE.map(async (f): Promise<Candidate> => {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${f.code}`, { next: { revalidate: 3600 } });
        const json = (await res.json()) as { data: { date: string; nav: string }[] };
        const navs = json.data.slice(0, 31).reverse().map((d) => Number(d.nav));
        const s = stats(navs);
        return {
          symbol: String(f.code),
          name: f.name,
          kind: f.kind,
          price: navs[navs.length - 1],
          return30d: s?.r30,
          annualized: s?.annualized,
          volatility: s?.vol,
          score: s ? s.annualized - s.vol * 25 : -999,
          eligible: true,
        };
      } catch (e) {
        return { symbol: String(f.code), name: f.name, kind: f.kind, score: -999, eligible: false, note: (e as Error).message.slice(0, 120) };
      }
    }),
  );
  return { list: list.sort((a, b) => b.score - a.score) };
}

export async function getRecommendations(force = false): Promise<Recommendation> {
  if (!force && cache && Date.now() - cache.at < 10 * 60_000) return cache.value;
  const rules = await getStore().listRules();
  const rulesEval = (symbol: string, tool: string) => {
    const r = evaluate(rules, { role: "treasury_manager", server: "alpaca", tool, input: { symbol, notional: 1000, side: "buy" } });
    return r.decision === "allowed" ? undefined : `${r.ruleId} ${r.ruleTitle}`;
  };
  const [us, india] = await Promise.all([scanUs(rulesEval), scanIndia()]);
  const maxPct = Number((rules.find((r) => r.id === "R3")?.params.maxPctPerFund as number | undefined) ?? 40);
  const top = us.list.filter((c) => c.eligible && c.score > -999).slice(0, 3);
  const weights = [maxPct, Math.min(maxPct, 35), Math.max(0, 100 - maxPct - Math.min(maxPct, 35))];
  const suggestedAllocation = top.map((c, i) => ({ symbol: c.symbol, name: c.name, pct: weights[i] ?? 0 })).filter((a) => a.pct > 0);
  const value: Recommendation = {
    asOf: new Date().toISOString(),
    spareCashInr: cashPosition().spareCash,
    us: us.list,
    india: india.list,
    suggestedAllocation,
    notes: [
      us.note,
      india.note,
      us.list.length ? "US yields are 30-day price returns; T-bill ETFs pay out monthly, so their true yield (~4%) is higher than shown." : undefined,
    ].filter(Boolean) as string[],
  };
  cache = { at: Date.now(), value };
  return value;
}

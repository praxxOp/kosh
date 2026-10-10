import { getAccount } from "@/lib/kosh/tools/alpaca";
import { agntidHealth } from "@/lib/kosh/gateway/agntid";
import { getStore } from "@/lib/kosh/store";
import { ACTIVE_COMPANY } from "@/lib/kosh/data/acme";
import { MODEL } from "@/lib/kosh/agent";
import type { ConnectorStatus } from "@/lib/kosh/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [alpaca, agntid] = await Promise.all([
    (async (): Promise<ConnectorStatus> => {
      if (!process.env.ALPACA_API_KEY) return { id: "alpaca", label: "Alpaca", connected: false, detail: "Keys not set" };
      try {
        const a = await getAccount();
        const paper = process.env.ALPACA_PAPER !== "false";
        return { id: "alpaca", label: "Alpaca", connected: true, detail: `${paper ? "Paper" : "LIVE"} · cash $${a.cash.toLocaleString("en-US", { maximumFractionDigits: 0 })}` };
      } catch (e) {
        return { id: "alpaca", label: "Alpaca", connected: false, detail: (e as Error).message.slice(0, 80) };
      }
    })(),
    (async (): Promise<ConnectorStatus> => {
      const h = await agntidHealth();
      return { id: "agntid", label: "AgntID", connected: h.reachable, detail: h.detail };
    })(),
  ]);
  const store = getStore();
  const list: ConnectorStatus[] = [
    { id: "tally", label: "Tally", connected: true, detail: `${ACTIVE_COMPANY} · demo books` },
    alpaca,
    agntid,
    { id: "model", label: "Model", connected: Boolean(process.env.OPENROUTER_API_KEY), detail: `OpenRouter · ${MODEL}` },
    { id: "supabase", label: "Supabase", connected: store.kind === "supabase", detail: store.kind === "supabase" ? "Persisting" : "In-memory store" },
  ];
  return Response.json(list);
}

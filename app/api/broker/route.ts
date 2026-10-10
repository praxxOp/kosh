import { getAccount, getOrders, getPositions } from "@/lib/kosh/tools/alpaca";
import { listTransfers } from "@/lib/kosh/tools/bank";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.ALPACA_API_KEY) return Response.json({ error: "Alpaca keys not set", transfers: listTransfers() });
  try {
    const [account, positions, orders] = await Promise.all([getAccount(), getPositions(), getOrders("all")]);
    return Response.json({ account, positions, orders, transfers: listTransfers() });
  } catch (e) {
    return Response.json({ error: (e as Error).message, transfers: listTransfers() });
  }
}

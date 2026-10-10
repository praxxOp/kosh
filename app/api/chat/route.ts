import { z } from "zod";
import { runAgent } from "@/lib/kosh/agent";
import { sseResponse } from "@/lib/kosh/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  taskId: z.string().optional(),
  role: z.enum(["analyst", "treasury_manager", "cfo"]),
  mode: z.enum(["off", "on"]),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
  if (!process.env.OPENROUTER_API_KEY) return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  return sseResponse(runAgent(parsed.data));
}

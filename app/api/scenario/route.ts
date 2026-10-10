import { z } from "zod";
import { runScenario, SCENARIO } from "@/lib/kosh/scenario";
import { sseResponse } from "@/lib/kosh/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return Response.json(SCENARIO);
}

export async function POST(req: Request) {
  const parsed = z.object({ mode: z.enum(["off", "on"]) }).safeParse(await req.json());
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
  return sseResponse(runScenario(parsed.data.mode));
}

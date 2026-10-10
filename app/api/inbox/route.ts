import { z } from "zod";
import { clearThreads, listThreads, postMessage } from "@/lib/kosh/inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(listThreads());
}

export async function DELETE() {
  return Response.json({ cleared: clearThreads() });
}

const Body = z.object({
  threadId: z.string().optional(),
  subject: z.string().optional(),
  from: z.enum(["analyst", "treasury_manager", "cfo", "kosh", "external"]),
  to: z.enum(["analyst", "treasury_manager", "cfo", "kosh", "external"]).optional(),
  content: z.string().trim().min(1),
});

/** People send text here; the order card on an approval request is posted by the gateway directly. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
  return Response.json(postMessage(parsed.data));
}

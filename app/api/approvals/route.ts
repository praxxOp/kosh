import { z } from "zod";
import { getStore } from "@/lib/kosh/store";
import { ApprovalError, decideApproval } from "@/lib/kosh/gateway";
import { AgntidSession } from "@/lib/kosh/gateway/agntid";
import { ROLE_USER_ID } from "@/lib/kosh/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getStore().listApprovals());
}

const Body = z.object({ id: z.string(), decision: z.enum(["submit", "approve", "reject"]), role: z.enum(["analyst", "treasury_manager", "cfo"]) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
  const { id, decision, role } = parsed.data;
  const pending = await getStore().getApproval(id);
  if (!pending) return new Response("Approval not found", { status: 404 });
  const agntid =
    decision === "approve" && AgntidSession.isConfigured()
      ? await AgntidSession.open({ taskId: pending.taskId, userId: ROLE_USER_ID[role], prompt: `Approval of ${pending.tool}` })
      : undefined;
  try {
    return Response.json(await decideApproval(id, decision, role, agntid));
  } catch (e) {
    if (e instanceof ApprovalError) return new Response(e.message, { status: e.status });
    throw e;
  } finally {
    await agntid?.close();
  }
}

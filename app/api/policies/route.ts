import { z } from "zod";
import { getStore } from "@/lib/kosh/store";

export const dynamic = "force-dynamic";

const Rule = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  category: z.enum(["money", "data", "access"]),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.unknown()).default({}),
  source: z.enum(["board", "company", "custom"]).default("custom"),
});

export async function GET() {
  return Response.json(await getStore().listRules());
}

export async function PUT(req: Request) {
  const parsed = Rule.safeParse(await req.json());
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
  await getStore().upsertRule(parsed.data);
  return Response.json(await getStore().listRules());
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });
  await getStore().deleteRule(id);
  return Response.json(await getStore().listRules());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { action?: string };
  if (body.action === "reset") {
    await getStore().resetRules();
    return Response.json(await getStore().listRules());
  }
  return new Response("unknown action", { status: 400 });
}

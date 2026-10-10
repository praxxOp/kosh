import { getStore } from "@/lib/kosh/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 200);
  return Response.json(await getStore().listAudit(limit));
}

export async function DELETE() {
  await getStore().clearAudit();
  return Response.json([]);
}

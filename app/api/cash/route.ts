import { cashPosition, INBOX } from "@/lib/kosh/data/acme";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ position: cashPosition(), inbox: INBOX });
}

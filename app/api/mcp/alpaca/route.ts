import { buildMcpHandler } from "@/lib/kosh/mcp-server";

const handler = buildMcpHandler("alpaca");
export { handler as GET, handler as POST, handler as DELETE };

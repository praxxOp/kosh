import { buildMcpHandler } from "@/lib/kosh/mcp-server";

const handler = buildMcpHandler("bank");
export { handler as GET, handler as POST, handler as DELETE };

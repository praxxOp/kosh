import { buildMcpHandler } from "@/lib/kosh/mcp-server";

const handler = buildMcpHandler("tally");
export { handler as GET, handler as POST, handler as DELETE };

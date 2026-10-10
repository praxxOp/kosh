// Smoke test for the MCP endpoints AgntID will proxy.
//   node scripts/test-mcp.mjs [server] [baseUrl]
//   node scripts/test-mcp.mjs tally http://localhost:3000
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const server = process.argv[2] ?? "tally";
const base = process.argv[3] ?? "http://localhost:3000";
const url = new URL(`${base}/api/mcp/${server}`);

const client = new Client({ name: "kosh-smoke", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(url));
const { tools } = await client.listTools();
console.log(`${server}: ${tools.length} tools →`, tools.map((t) => t.name).join(", "));

const probe = { tally: ["tally_get_cash_position", {}], alpaca: ["alpaca_get_account", {}], bank: ["bank_list_accounts", {}], kosh: ["kosh_get_recommendations", {}] }[server];
if (probe) {
  // AgntID injects _task_id into every forwarded call; the server must ignore it.
  const res = await client.callTool({ name: probe[0], arguments: { ...probe[1], _task_id: "smoke-task" } });
  const text = res.content?.find((c) => c.type === "text")?.text ?? "";
  console.log(`${probe[0]} →`, res.isError ? `ERROR ${text}` : text.slice(0, 200));
}
await client.close();

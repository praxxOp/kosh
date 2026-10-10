// Call one tool through the AgntID proxy inside a task and print the raw result.
//   node scripts/probe-agntid-call.mjs <tool-name> '<json-args>' [user_id] [prompt]
//   node scripts/probe-agntid-call.mjs tally_tally_get_cash_position '{}' treasury@acme.demo "Read the cash position"
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [tool, argsJson = "{}", userId = "treasury@acme.demo", prompt = "Invest spare cash safely per policy"] = process.argv.slice(2);
if (!tool) {
  console.error("usage: node scripts/probe-agntid-call.mjs <tool> '<json-args>' [user_id] [prompt]");
  process.exit(1);
}
const url = process.env.AGNTID_MCP_URL ?? "http://localhost:8082/mcp";
const client = new Client({ name: "kosh-probe", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const taskId = `probe-${Date.now()}`;
const open = await client.callTool({ name: "agntid_task_open", arguments: { task_id: taskId, agent_id: "kosh-treasury-agent", user_id: userId, prompt } });
const openText = open.content?.find((c) => c.type === "text")?.text ?? "";
try {
  const o = JSON.parse(openText);
  console.log(`task_open ok=${o.ok} relevant=${(o.intent?.snapshot?.relevant_tool_names ?? []).join(",") || "-"}`);
} catch {
  console.log("task_open:", openText.slice(0, 200));
}
const res = await client.callTool({ name: tool, arguments: { ...JSON.parse(argsJson), agntid_task_id: taskId, _task_id: taskId } }).catch((e) => ({ isError: true, content: [{ type: "text", text: `thrown: ${e.message}` }] }));
console.log(`\n${tool} → isError=${Boolean(res.isError)}`);
console.log((res.content?.find((c) => c.type === "text")?.text ?? JSON.stringify(res)).slice(0, 1200));
await client.callTool({ name: "agntid_task_close", arguments: { task_id: taskId } }).catch(() => {});
await client.close();

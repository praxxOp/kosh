// Open a task on the AgntID proxy, call a read-only and a destructive demo tool, print raw results.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const url = process.argv[2] ?? "http://localhost:8082/mcp";
const client = new Client({ name: "kosh-probe", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const taskId = `probe-${Date.now()}`;
const show = (label, r) => console.log(`\n== ${label} ==\n` + JSON.stringify(r, null, 1).slice(0, 900));
show("task_open", await client.callTool({ name: "agntid_task_open", arguments: { task_id: taskId, agent_id: "kosh-treasury-agent", user_id: "treasury@acme.demo", prompt: "Check ticket 42 then delete ticket 42" } }));
show("get_ticket", await client.callTool({ name: "demo_get_ticket", arguments: { ticket_id: "42", _task_id: taskId } }).catch((e) => ({ thrown: e.message })));
show("delete_ticket", await client.callTool({ name: "demo_delete_ticket", arguments: { ticket_id: "42", _task_id: taskId } }).catch((e) => ({ thrown: e.message })));
show("add_numbers (off-intent)", await client.callTool({ name: "demo_add_numbers", arguments: { first_number: 2, second_number: 3, _task_id: taskId } }).catch((e) => ({ thrown: e.message })));
show("task_close", await client.callTool({ name: "agntid_task_close", arguments: { task_id: taskId } }));
await client.close();

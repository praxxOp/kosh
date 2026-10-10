import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const url = process.argv[2] ?? "http://localhost:8082/mcp";
const client = new Client({ name: "kosh-probe", version: "0.1.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const { tools } = await client.listTools();
  console.log(`connected: ${tools.length} tools`);
  for (const t of tools) console.log(" -", t.name, "|", (t.description ?? "").slice(0, 90).replace(/\n/g, " "));
  const demo = tools.find((t) => t.name === "demo_add_numbers");
  if (demo) {
    console.log("demo_add_numbers schema:", JSON.stringify(demo.inputSchema).slice(0, 200));
    const r = await client.callTool({ name: "demo_add_numbers", arguments: { a: 2, b: 3, _task_id: "probe" } });
    console.log("call →", JSON.stringify(r).slice(0, 300));
  }
  await client.close();
} catch (e) {
  console.log("probe failed:", e.message);
}

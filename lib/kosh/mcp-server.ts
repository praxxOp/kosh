import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { toolsForServer } from "./tools/registry";
import type { ServerId } from "./types";

// The AgntID proxy turns a tool with zero properties into one with a required `kwargs`
// string, which then fails validation. Publishing one optional field avoids that.
const EMPTY_INPUT = z.object({ note: z.string().optional().describe("Optional note for the audit trail; ignored") });

/**
 * Exposes one tool server (tally / alpaca / bank / kosh) over MCP streamable HTTP so the
 * AgntID runtime can proxy it. From Docker the runtime reaches these at
 * http://host.docker.internal:3000/api/mcp/<server>.
 * Calls forwarded by AgntID carry an extra `_task_id` argument; zod strips it.
 */
export function buildMcpHandler(server: ServerId) {
  return createMcpHandler(
    (mcp) => {
      for (const t of toolsForServer(server)) {
        const schema = Object.keys(t.inputSchema.shape).length === 0 ? EMPTY_INPUT : t.inputSchema;
        mcp.registerTool(
          t.name,
          { title: t.name, description: t.description, inputSchema: schema },
          async (input: unknown) => {
            try {
              const { note: _note, ...rest } = (input ?? {}) as Record<string, unknown>;
              void _note;
              const out = await t.run(rest);
              return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
            } catch (e) {
              return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] };
            }
          },
        );
      }
    },
    { serverInfo: { name: `kosh-${server}`, version: "0.1.0" } },
  );
}

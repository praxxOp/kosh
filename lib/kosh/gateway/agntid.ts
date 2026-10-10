import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * A per-prompt session against the AgntID MCP proxy.
 * Mirrors the Python SDK's task glue: open a task, inject `_task_id` into every call,
 * strip `__agntid_*` keys from results, close the task at the end.
 */

export type AgntidCallResult =
  | { ok: true; output: unknown }
  | { ok: false; denied: boolean; message: string };

const DENIAL_RE = /denied|deny|policy|not permitted|not allowed|blocked|forbidden|unauthori[sz]ed|violat/i;

function stripAgntidKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAgntidKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("__agntid_result" in obj) return stripAgntidKeys(obj.__agntid_result);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith("__agntid_")) out[k] = stripAgntidKeys(v);
    return out;
  }
  return value;
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c && typeof c === "object" && (c as { type?: string }).type === "text" ? String((c as { text?: string }).text ?? "") : ""))
    .join("\n")
    .trim();
}

export class AgntidSession {
  private constructor(
    private client: Client,
    private toolNames: string[],
    readonly taskId: string,
    private hasTaskTools: boolean,
  ) {}

  static isConfigured() {
    return Boolean(process.env.AGNTID_MCP_URL);
  }

  /** Returns undefined when AgntID is not configured or not reachable, so callers can fall back. */
  static async open(opts: { taskId: string; userId: string; prompt: string }): Promise<AgntidSession | undefined> {
    const url = process.env.AGNTID_MCP_URL;
    if (!url) return undefined;
    const token = process.env.AGNTID_ACCESS_TOKEN;
    const client = new Client({ name: "kosh", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
    try {
      await withTimeout(client.connect(transport), 6000, "AgntID connect");
      const { tools } = await withTimeout(client.listTools(), 6000, "AgntID listTools");
      const names = tools.map((t) => t.name);
      const hasTaskTools = names.includes("agntid_task_open");
      const session = new AgntidSession(client, names, opts.taskId, hasTaskTools);
      if (hasTaskTools) {
        await client.callTool({
          name: "agntid_task_open",
          arguments: {
            task_id: opts.taskId,
            agent_id: process.env.AGNTID_AGENT_ID ?? "kosh-treasury-agent",
            user_id: opts.userId,
            prompt: opts.prompt,
          },
        });
      }
      return session;
    } catch (e) {
      console.warn(`[agntid] unavailable: ${(e as Error).message}`);
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      return undefined;
    }
  }

  /** Upstream tools may be exposed with a server prefix; match exact name first, then suffix. */
  resolve(tool: string): string | undefined {
    if (this.toolNames.includes(tool)) return tool;
    return this.toolNames.find((n) => n.endsWith(tool) || n.endsWith(`_${tool}`) || n.endsWith(`.${tool}`) || n.endsWith(`/${tool}`));
  }

  listTools() {
    return this.toolNames;
  }

  async call(tool: string, input: Record<string, unknown>): Promise<AgntidCallResult> {
    const name = this.resolve(tool);
    if (!name) return { ok: false, denied: true, message: `AgntID does not expose "${tool}" to this agent.` };
    try {
      // The proxy's published schema names the correlation field `agntid_task_id`; the Python SDK
      // historically used `_task_id`. Send both; upstream zod schemas strip whatever is unused.
      const res = await withTimeout(
        this.client.callTool({ name, arguments: { ...input, agntid_task_id: this.taskId, _task_id: this.taskId } }),
        30_000,
        `AgntID call ${tool}`,
      );
      const r = res as { isError?: boolean; content?: unknown; structuredContent?: unknown };
      const text = textOf(r.content);
      if (r.isError) {
        const decision = parseDecision(text);
        if (decision) return { ok: false, denied: true, message: decision };
        return { ok: false, denied: DENIAL_RE.test(text), message: text || "Tool call failed" };
      }
      if (r.structuredContent !== undefined) return { ok: true, output: stripAgntidKeys(r.structuredContent) };
      try {
        return { ok: true, output: stripAgntidKeys(JSON.parse(text)) };
      } catch {
        return { ok: true, output: text };
      }
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      return { ok: false, denied: DENIAL_RE.test(message), message };
    }
  }

  async close() {
    try {
      if (this.hasTaskTools) await this.client.callTool({ name: "agntid_task_close", arguments: { task_id: this.taskId } });
    } catch {
      /* ignore */
    }
    try {
      await this.client.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Denials arrive as an error text like
 *   "Error executing tool X: {"__agntid_execution_flow": {...}, "__agntid_policy_decision": {...}, ...}"
 * Pull out the policy decision so the UI can show which AgntID policy fired.
 */
function parseDecision(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  try {
    const obj = JSON.parse(text.slice(start)) as Record<string, unknown>;
    const flow = obj.__agntid_execution_flow as { denial_step?: string; denial_reason?: string; status?: string } | undefined;
    const pd = obj.__agntid_policy_decision as { policy_name?: string; reason?: string; allowed?: boolean } | undefined;
    if (!flow && !pd) return undefined;
    const parts = [
      pd?.policy_name ? `AgntID policy ${pd.policy_name}` : "AgntID",
      flow?.denial_step ? `denied at ${flow.denial_step.replace(/_/g, " ")}` : "denied",
      pd?.reason ?? flow?.denial_reason,
    ].filter(Boolean);
    return parts.join(": ");
  } catch {
    return undefined;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }, (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** Cheap reachability probe for the connector pill. */
export async function agntidHealth(): Promise<{ configured: boolean; reachable: boolean; detail: string }> {
  const url = process.env.AGNTID_MCP_URL;
  if (!url) return { configured: false, reachable: false, detail: "AGNTID_MCP_URL not set" };
  const s = await AgntidSession.open({ taskId: `probe-${Date.now()}`, userId: "probe@kosh", prompt: "health probe" });
  if (!s) return { configured: true, reachable: false, detail: `No response from ${url}` };
  const n = s.listTools().length;
  await s.close();
  return { configured: true, reachable: true, detail: `${n} tools behind the proxy` };
}

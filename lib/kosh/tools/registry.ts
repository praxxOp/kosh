import type OpenAI from "openai";
import { z } from "zod";
import type { ToolDef } from "./types";
import { tallyTools } from "./tally";
import { alpacaTools } from "./alpaca";
import { bankTools } from "./bank";
import { getRecommendations } from "../recommend";
import type { ServerId } from "../types";

const koshTools: ToolDef[] = [
  {
    server: "kosh",
    name: "kosh_get_recommendations",
    description:
      "Run the recommendation pipeline: scans live market data for liquid instruments (US T-bill ETFs and Indian liquid funds), scores them, and marks which are eligible under the treasury policy with a suggested allocation.",
    inputSchema: z.object({}),
    run: async () => {
      const r = await getRecommendations();
      return {
        asOf: r.asOf,
        suggestedAllocation: r.suggestedAllocation,
        us: r.us.map(({ symbol, name, kind, price, annualized, volatility, eligible, excludedBy }) => ({
          symbol, name, kind, price, annualizedPct: annualized?.toFixed(2), dailyVolPct: volatility?.toFixed(2), eligible, excludedBy,
        })),
        india: r.india.map(({ symbol, name, kind, annualized }) => ({ schemeCode: symbol, name, kind, annualizedPct: annualized?.toFixed(2) })),
      };
    },
  },
];

const ALL_TOOLS: ToolDef[] = [...tallyTools, ...alpacaTools, ...bankTools, ...koshTools];

export const toolByName = (name: string) => ALL_TOOLS.find((t) => t.name === name);

export const toolsForServer = (server: ServerId) => ALL_TOOLS.filter((t) => t.server === server);

/** OpenAI-format tool definitions (used via OpenRouter) generated from the zod schemas. */
export function openaiTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return ALL_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
    },
  }));
}

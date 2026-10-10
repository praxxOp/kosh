import type { z } from "zod";
import type { ServerId } from "../types";

export interface ToolDef {
  server: ServerId;
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  run: (input: Record<string, unknown>) => Promise<unknown>;
  /** Marks tools whose only purpose is to show what an unguarded agent can do. */
  dangerous?: boolean;
}

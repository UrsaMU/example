import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { IGMConfig } from "./schema.ts";

// ─── Provider factory ─────────────────────────────────────────────────────────
//
// Returns a ChatGoogleGenerativeAI instance configured from IGMConfig.
// API key is read from config first, then falls back to GOOGLE_API_KEY env.

export function createModel(config: IGMConfig): ChatGoogleGenerativeAI {
  const apiKey = config.apiKey ?? Deno.env.get("GOOGLE_API_KEY") ?? "";

  if (!apiKey) {
    throw new Error(
      "GM: No Google API key configured. " +
        "Set GOOGLE_API_KEY env or use +gm/config/apikey <key>.",
    );
  }

  return new ChatGoogleGenerativeAI({
    model: config.model,
    apiKey,
    temperature: config.temperature,
    maxRetries: 2,
  });
}

// ─── Config loader with default fallback ─────────────────────────────────────

import { gmConfig } from "./db.ts";
import { DEFAULT_CONFIG } from "./schema.ts";

export async function loadConfig(): Promise<IGMConfig> {
  const stored = await gmConfig.queryOne(
    { id: "singleton" } as Parameters<typeof gmConfig.queryOne>[0],
  );
  return stored ?? { ...DEFAULT_CONFIG, updatedAt: 0 };
}

export async function saveConfig(
  update: Partial<Omit<IGMConfig, "id">>,
): Promise<IGMConfig> {
  const current = await loadConfig();
  const next: IGMConfig = {
    ...current,
    ...update,
    id: "singleton",
    updatedAt: Date.now(),
  };

  const existing = await gmConfig.queryOne(
    { id: "singleton" } as Parameters<typeof gmConfig.queryOne>[0],
  );
  if (existing) {
    await gmConfig.modify(
      { id: "singleton" } as Parameters<typeof gmConfig.modify>[0],
      "$set",
      { ...update, updatedAt: next.updatedAt },
    );
  } else {
    await gmConfig.create(next);
  }
  return next;
}

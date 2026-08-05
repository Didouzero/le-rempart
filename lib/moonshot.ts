/**
 * Client Moonshot / Kimi en fetch brut.
 * Le SDK OpenAI peut ne pas propager correctement `thinking` / `reasoning_effort`.
 */

import { recordTokenUsage } from "@/lib/eval/token-meter";

export type MoonshotMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export type MoonshotUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type MoonshotChatResult = {
  content: string;
  usage?: MoonshotUsage;
};

export async function moonshotChatDetailed(input: {
  model: string;
  messages: MoonshotMessage[];
  maxTokens?: number;
  timeoutMs?: number;
  /** Pour kimi-k3 : low | high | max */
  reasoningEffort?: "low" | "high" | "max";
}): Promise<MoonshotChatResult> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set");

  const timeoutMs = input.timeoutMs ?? 20_000;
  const model = input.model;
  const body: Record<string, unknown> = {
    model,
    max_tokens: input.maxTokens ?? 1200,
    messages: input.messages,
  };

  // k2.6 : thinking ON par défaut → hangs. k3 : reasoning_effort.
  if (model.includes("k2.6") || model.includes("k2.5")) {
    body.thinking = { type: "disabled" };
  } else if (model.includes("k3")) {
    body.reasoning_effort = input.reasoningEffort || "low";
  } else {
    body.thinking = { type: "disabled" };
  }

  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: MoonshotUsage;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Moonshot HTTP ${res.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Réponse Kimi vide");

  if (data.usage) {
    recordTokenUsage(data.usage);
  }

  return { content, usage: data.usage };
}

export async function moonshotChat(input: {
  model: string;
  messages: MoonshotMessage[];
  maxTokens?: number;
  timeoutMs?: number;
  reasoningEffort?: "low" | "high" | "max";
}): Promise<string> {
  const { content } = await moonshotChatDetailed(input);
  return content;
}

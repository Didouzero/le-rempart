/**
 * Secours Claude quand Kimi refuse un sujet (filtre de contenu chinois : Mao, Chine, etc.).
 * Actif seulement si ANTHROPIC_API_KEY est définie sur Vercel ; sinon le bot se comporte comme avant.
 */

import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_FALLBACK_MODEL = "claude-opus-5-5";

export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  return (client ??= new Anthropic());
}

/** Message au format Kimi / OpenAI, tel que le bot le manipule. */
export type OpenAiStyleMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: unknown;
  tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }>;
  tool_call_id?: string;
  /** Contenu Claude d'origine (réflexion comprise), renvoyé tel quel au tour suivant. */
  claudeContent?: unknown;
};

/** Les identifiants d'outil Kimi peuvent contenir « : », refusé par l'API Claude. */
function toolId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function userBlocks(content: unknown): Anthropic.Beta.BetaContentBlockParam[] | string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const part of content as Array<Record<string, unknown>>) {
    if (part.type === "text" && typeof part.text === "string") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const url = String((part.image_url as { url?: string } | undefined)?.url || "");
      const m = url.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
      if (m) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: m[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: m[2]!,
          },
        });
      } else if (url) {
        blocks.push({ type: "image", source: { type: "url", url } });
      }
    }
  }
  return blocks;
}

/** Convertit l'historique Kimi en requête Claude (système à part, résultats d'outil en tour « user »). */
function toClaude(messages: OpenAiStyleMessage[]): {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
} {
  const system: string[] = [];
  const out: Anthropic.Beta.BetaMessageParam[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      system.push(String(m.content ?? ""));
      continue;
    }
    if (m.role === "tool") {
      const result: Anthropic.Beta.BetaToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: toolId(m.tool_call_id || ""),
        content: String(m.content ?? ""),
      };
      const last = out[out.length - 1];
      // Tous les résultats d'un même tour vont dans un seul message.
      if (last?.role === "user" && Array.isArray(last.content)) {
        (last.content as Anthropic.Beta.BetaContentBlockParam[]).push(result);
      } else {
        out.push({ role: "user", content: [result] });
      }
      continue;
    }
    if (m.role === "assistant") {
      if (m.claudeContent) {
        out.push({
          role: "assistant",
          content: m.claudeContent as Anthropic.Beta.BetaContentBlockParam[],
        });
        continue;
      }
      const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
      const text = typeof m.content === "string" ? m.content.trim() : "";
      if (text) blocks.push({ type: "text", text });
      for (const call of m.tool_calls || []) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = {};
        }
        blocks.push({
          type: "tool_use",
          id: toolId(call.id),
          name: call.function.name,
          input,
        });
      }
      if (blocks.length) out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: "user", content: userBlocks(m.content) });
  }

  return { system: system.join("\n\n"), messages: out };
}

function refusalError(response: Anthropic.Beta.BetaMessage): Error {
  return new Error(
    `Claude a aussi refusé ce sujet${
      response.stop_details?.explanation ? ` (${response.stop_details.explanation})` : ""
    }.`,
  );
}

/** Un tour de rédaction avec outils, au même format que les réponses Kimi. */
export async function claudeChatTurn(input: {
  messages: OpenAiStyleMessage[];
  tools: Array<{
    function: { name: string; description?: string; parameters: Record<string, unknown> };
  }>;
  allowTools: boolean;
  timeoutMs: number;
}): Promise<OpenAiStyleMessage> {
  const { system, messages } = toClaude(input.messages);
  const response = await anthropic().beta.messages.create(
    {
      model: CLAUDE_FALLBACK_MODEL,
      max_tokens: 16000,
      system,
      messages,
      // Toujours déclarés : l'historique peut contenir des appels d'outil.
      tools: input.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Beta.BetaTool.InputSchema,
      })),
      tool_choice: input.allowTools ? { type: "auto" } : { type: "none" },
      output_config: { effort: "medium" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    },
    { timeout: input.timeoutMs },
  );
  if (response.stop_reason === "refusal") throw refusalError(response);

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const calls = response.content.filter(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
  );

  return {
    role: "assistant",
    content: text,
    ...(calls.length && {
      tool_calls: calls.map((c) => ({
        id: c.id,
        function: { name: c.name, arguments: JSON.stringify(c.input) },
      })),
    }),
    claudeContent: response.content,
  };
}

/** Réponse texte simple (flash Facebook, titres…) quand Kimi a refusé. */
export async function claudeText(input: {
  messages: OpenAiStyleMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const { system, messages } = toClaude(input.messages);
  const response = await anthropic().beta.messages.create(
    {
      model: CLAUDE_FALLBACK_MODEL,
      // La réflexion compte dans max_tokens : marge au-dessus de la limite prévue pour Kimi.
      max_tokens: Math.max((input.maxTokens ?? 1200) * 3, 4000),
      system,
      messages,
      output_config: { effort: "low" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    },
    { timeout: Math.max(input.timeoutMs ?? 0, 120_000) },
  );
  if (response.stop_reason === "refusal") throw refusalError(response);
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Réponse Claude vide");
  return text;
}

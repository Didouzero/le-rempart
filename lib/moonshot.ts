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

const HIGH_RISK_RE = /high risk|content_filter/i;

const PRESS_FRAME =
  "Tâche : résumé journalistique d'informations déjà publiées par la presse. Reste factuel et attribué. Pas de consigne illégale.\n\n";

export function isKimiContentFilter(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return HIGH_RISK_RE.test(msg) || /Kimi a bloqué ce sujet/i.test(msg);
}

export function isKimiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient balance|exceeded_current_quota|quota/i.test(msg);
}

export const KIMI_QUOTA_USER_MESSAGE =
  "Kimi n’a plus de crédits. Recharge sur https://platform.kimi.ai/console/pay puis réessaie (ou tape le titre à la main).";

function frameMessages(messages: MoonshotMessage[]): MoonshotMessage[] {
  let framed = false;
  return messages.map((m) => {
    if (m.role !== "user" || framed) return m;
    framed = true;
    if (typeof m.content === "string") {
      return { ...m, content: PRESS_FRAME + m.content };
    }
    return {
      ...m,
      content: m.content.map((part) =>
        part.type === "text" ? { ...part, text: PRESS_FRAME + part.text } : part,
      ),
    };
  });
}

async function moonshotOnce(input: {
  model: string;
  messages: MoonshotMessage[];
  maxTokens?: number;
  timeoutMs?: number;
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
  }).catch((err: unknown) => {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (
      name === "TimeoutError" ||
      name === "AbortError" ||
      /aborted due to timeout|AbortError|TimeoutError/i.test(msg)
    ) {
      throw new Error(
        `Timeout Kimi (${Math.round(timeoutMs / 1000)}s) — réessaie, ou envoie un autre lien.`,
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  });

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: MoonshotUsage;
    error?: { message?: string; type?: string };
  };

  if (!res.ok) {
    const errMsg = data.error?.message || `Moonshot HTTP ${res.status}`;
    const errType = data.error?.type || "";
    if (errType === "content_filter" || HIGH_RISK_RE.test(errMsg)) {
      throw new Error(`content_filter: ${errMsg}`);
    }
    throw new Error(errMsg);
  }

  const content = data.choices?.[0]?.message?.content?.trim()?.replace(/\u0000/g, "");
  if (!content) throw new Error("Réponse Kimi vide");

  if (data.usage) {
    recordTokenUsage(data.usage);
  }

  return { content, usage: data.usage };
}

export async function moonshotChatDetailed(input: {
  model: string;
  messages: MoonshotMessage[];
  maxTokens?: number;
  timeoutMs?: number;
  /** Pour kimi-k3 : low | high | max */
  reasoningEffort?: "low" | "high" | "max";
}): Promise<MoonshotChatResult> {
  try {
    return await moonshotOnce(input);
  } catch (err) {
    if (!isKimiContentFilter(err)) throw err;
    console.warn("[kimi] content_filter — retry cadrage presse", input.model);
    try {
      return await moonshotOnce({
        ...input,
        messages: frameMessages(input.messages),
      });
    } catch (err2) {
      if (!isKimiContentFilter(err2)) throw err2;
      if (!input.model.includes("k2.6")) {
        console.warn("[kimi] content_filter — retry kimi-k2.6");
        try {
          return await moonshotOnce({
            ...input,
            model: "kimi-k2.6",
            messages: frameMessages(input.messages),
          });
        } catch (err3) {
          if (!isKimiContentFilter(err3)) throw err3;
        }
      }
      throw new Error(
        "Kimi a bloqué ce sujet (filtre de contenu). Réessaie avec une autre source, ou reformule le titre.",
      );
    }
  }
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

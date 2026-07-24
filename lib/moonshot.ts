/**
 * Client Moonshot / Kimi en fetch brut.
 * Le SDK OpenAI peut ne pas propager correctement `thinking: disabled`
 * et son timeout n'abort pas toujours → hangs Vercel.
 */

export type MoonshotMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export async function moonshotChat(input: {
  model: string;
  messages: MoonshotMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set");

  const timeoutMs = input.timeoutMs ?? 20_000;
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 1200,
      messages: input.messages,
      // Critique : sans ça, kimi-k2.6 peut tourner >1–2 min
      thinking: { type: "disabled" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Moonshot HTTP ${res.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Réponse Kimi vide");
  return content;
}

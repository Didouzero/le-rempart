export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
};

type MeterState = {
  byStage: Map<string, TokenUsage>;
  currentStage: string;
};

const emptyUsage = (): TokenUsage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  calls: 0,
});

let active: MeterState | null = null;

export function beginTokenMeter(stage = "default"): void {
  active = {
    byStage: new Map(),
    currentStage: stage,
  };
}

export function setTokenMeterStage(stage: string): void {
  if (active) active.currentStage = stage;
}

export function endTokenMeter(): Record<string, TokenUsage> {
  if (!active) return {};
  const out: Record<string, TokenUsage> = {};
  for (const [stage, usage] of active.byStage) {
    out[stage] = { ...usage };
  }
  active = null;
  return out;
}

export function recordTokenUsage(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): void {
  if (!active) return;
  const stage = active.currentStage;
  const prev = active.byStage.get(stage) || emptyUsage();
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  const total = usage.total_tokens || prompt + completion;
  active.byStage.set(stage, {
    promptTokens: prev.promptTokens + prompt,
    completionTokens: prev.completionTokens + completion,
    totalTokens: prev.totalTokens + total,
    calls: prev.calls + 1,
  });
}

export function sumTokenUsage(
  byStage: Record<string, TokenUsage>,
): TokenUsage {
  return Object.values(byStage).reduce(
    (acc, u) => ({
      promptTokens: acc.promptTokens + u.promptTokens,
      completionTokens: acc.completionTokens + u.completionTokens,
      totalTokens: acc.totalTokens + u.totalTokens,
      calls: acc.calls + u.calls,
    }),
    emptyUsage(),
  );
}

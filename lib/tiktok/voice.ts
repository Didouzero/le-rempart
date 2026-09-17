const DEFAULT_VOICE_ID = "FpvROcY4IGWevepmBWO2";
const DEFAULT_MODEL = "eleven_multilingual_v2";

export type TiktokVoiceResult = {
  audio: Buffer;
  mime: string;
  durationMs: number;
};

function durationFromAlignment(alignment: {
  character_end_times_seconds?: number[];
  characters?: string[];
}): number {
  const ends = alignment.character_end_times_seconds || [];
  const last = ends[ends.length - 1];
  if (typeof last === "number" && last > 0) {
    return Math.round(last * 1000);
  }
  return 0;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export async function synthesizeJournalistVoice(
  text: string,
): Promise<TiktokVoiceResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY n’est pas configurée.");

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId =
    process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: modelId,
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.78,
          style: 0.22,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  const data = (await res.json()) as {
    audio_base64?: string;
    alignment?: {
      character_end_times_seconds?: number[];
      characters?: string[];
    };
    detail?: { message?: string } | string;
    message?: string;
  };

  if (!res.ok || !data.audio_base64) {
    const detail =
      (typeof data.detail === "string"
        ? data.detail
        : data.detail?.message) ||
      data.message ||
      `ElevenLabs HTTP ${res.status}`;
    throw new Error(detail);
  }

  const audio = Buffer.from(data.audio_base64, "base64");
  let durationMs = durationFromAlignment(data.alignment || {});
  if (durationMs < 5_000) {
    // ~16 kB/s for 128 kbps mp3 — last-resort estimate
    durationMs = Math.round((audio.length / 16000) * 1000);
  }

  return { audio, mime: "audio/mpeg", durationMs };
}

const DEFAULT_MODEL = "eleven_multilingual_v2";

export type TiktokVoiceResult = {
  audio: Buffer;
  mime: string;
  durationMs: number;
};

type ElevenLabsVoice = {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
};

let cachedVoiceId: string | null = null;

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

function voiceScore(voice: ElevenLabsVoice): number {
  const name = (voice.name || "").toLowerCase();
  const labels = voice.labels || {};
  const language = (labels.language || labels.accent || "").toLowerCase();
  const useCase = (labels.use_case || labels.descriptive || "").toLowerCase();
  let score = 0;
  if (language.includes("fr") || language.includes("french")) score += 80;
  if (name.includes("français") || name.includes("french") || name.includes("france")) {
    score += 40;
  }
  if (
    name.includes("journal") ||
    name.includes("news") ||
    useCase.includes("narrat") ||
    useCase.includes("news")
  ) {
    score += 25;
  }
  if ((labels.gender || "").toLowerCase() === "male") score += 8;
  if (voice.category === "premade") score += 6;
  if (voice.category === "cloned" || voice.category === "professional") score += 10;
  return score;
}

async function listAccountVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as {
    voices?: ElevenLabsVoice[];
    detail?: { message?: string } | string;
  };
  if (!res.ok) {
    const detail =
      (typeof data.detail === "string" ? data.detail : data.detail?.message) ||
      `ElevenLabs HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data.voices || [];
}

async function resolveVoiceId(apiKey: string): Promise<string> {
  const configured = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (configured) return configured;
  if (cachedVoiceId) return cachedVoiceId;

  const voices = await listAccountVoices(apiKey);
  const usable = voices.filter((voice) => voice.voice_id);
  if (!usable.length) {
    throw new Error(
      "Aucune voix ElevenLabs sur ce compte. Ajoute une voix FR dans ElevenLabs, ou définis ELEVENLABS_VOICE_ID.",
    );
  }
  usable.sort((a, b) => voiceScore(b) - voiceScore(a));
  cachedVoiceId = usable[0].voice_id as string;
  return cachedVoiceId;
}

async function requestSpeech(
  apiKey: string,
  voiceId: string,
  modelId: string,
  text: string,
): Promise<Response> {
  return fetch(
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
}

function parseElevenLabsError(data: {
  detail?: { message?: string } | string;
  message?: string;
}): string {
  return (
    (typeof data.detail === "string" ? data.detail : data.detail?.message) ||
    data.message ||
    "ElevenLabs error"
  );
}

export async function synthesizeJournalistVoice(
  text: string,
): Promise<TiktokVoiceResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY n’est pas configurée.");

  const modelId =
    process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL;
  let voiceId = await resolveVoiceId(apiKey);

  let res = await requestSpeech(apiKey, voiceId, modelId, text);
  let data = (await res.json()) as {
    audio_base64?: string;
    alignment?: {
      character_end_times_seconds?: number[];
      characters?: string[];
    };
    detail?: { message?: string } | string;
    message?: string;
  };

  const notFound =
    !res.ok && /voice_id|was not found|does not exist/i.test(parseElevenLabsError(data));
  if (notFound) {
    cachedVoiceId = null;
    const voices = await listAccountVoices(apiKey);
    const fallback = voices
      .filter((voice) => voice.voice_id && voice.voice_id !== voiceId)
      .sort((a, b) => voiceScore(b) - voiceScore(a))[0];
    if (!fallback?.voice_id) {
      throw new Error(
        "Voix ElevenLabs introuvable sur ce compte. Ajoute une voix FR ou définis ELEVENLABS_VOICE_ID.",
      );
    }
    voiceId = fallback.voice_id;
    cachedVoiceId = voiceId;
    res = await requestSpeech(apiKey, voiceId, modelId, text);
    data = (await res.json()) as typeof data;
  }

  if (!res.ok || !data.audio_base64) {
    throw new Error(parseElevenLabsError(data) || `ElevenLabs HTTP ${res.status}`);
  }

  const audio = Buffer.from(data.audio_base64, "base64");
  let durationMs = durationFromAlignment(data.alignment || {});
  if (durationMs < 5_000) {
    // ~16 kB/s for 128 kbps mp3 — last-resort estimate
    durationMs = Math.round((audio.length / 16000) * 1000);
  }

  return { audio, mime: "audio/mpeg", durationMs };
}

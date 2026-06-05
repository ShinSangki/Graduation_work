import { BiographyBook } from "../data/sampleBiography";
import { Capacitor } from "@capacitor/core";

function resolveApiBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (Capacitor.isNativePlatform()) {
    throw new Error(
      "Android 실기에서는 VITE_API_BASE_URL이 필요합니다. 예: http://PC사설IP:3001"
    );
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export function getApiUrl(path: string) {
  return `${resolveApiBaseUrl()}${path}`;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const retryDelays = [2000, 4000, 6000];

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.status !== 503 || attempt === retryDelays.length) return response;
    } catch (error) {
      if (attempt === retryDelays.length) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
  }
}

export type GeneratedMemoir = {
  title: string;
  sttRawText?: string;
  chapters: {
    title: string;
    sections: {
      title: string;
      time?: string;
      place?: string;
      summary?: string;
      content: string;
    }[];
  }[];
};

export type GenerateEpisodeRequest = {
  sttRawText: string;
  time?: string;
  place?: string;
};

export type GeneratedEpisode = {
  episode: {
    episode_id: string;
    title: string;
    content: string;
    tags: string[];
  };
  metadata: {
    stt_length: number;
    summary_length: number;
    compression_rate: number;
    target_max_length: number;
    compression_target_met: boolean;
    llm_model: string;
    api_call_count: number;
    usage: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      thoughtsTokenCount: number;
      totalTokenCount: number;
    };
  };
};

type GenerateEpisodeResponse =
  | ({ success: true } & GeneratedEpisode)
  | { success: false; error?: string };

export async function generateEpisodeFromText(
  request: GenerateEpisodeRequest
): Promise<GeneratedEpisode> {
  const response = await fetchWithRetry(getApiUrl("/api/generate-from-text"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await response.json().catch(() => ({}))) as GenerateEpisodeResponse;

  if (!response.ok || !body.success) {
    throw new Error("error" in body ? body.error || "자서전 생성에 실패했습니다." : "자서전 생성에 실패했습니다.");
  }

  return {
    episode: body.episode,
    metadata: body.metadata,
  };
}

function formatRecordedAt(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join(".");
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export async function generateMemoir(
  audioBlob: Blob,
  time: string,
  place: string,
  audioUrl?: string
): Promise<BiographyBook> {
  const formData = new FormData();
  formData.append("audio", audioBlob, `recording-${Date.now()}.${getAudioExtension(audioBlob.type)}`);
  formData.append("time", time);
  formData.append("place", place);

  const response = await fetchWithRetry(getApiUrl("/api/generate"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "자서전 생성에 실패했습니다.");
  }

  const memoir = (await response.json()) as GeneratedMemoir;
  return {
    id: `local-${Date.now()}`,
    title: memoir.title,
    createdAt: new Date().toISOString(),
    recordedAt: formatRecordedAt(),
    audioUrl,
    rawText: memoir.sttRawText,
    chapters: memoir.chapters.map((chapter, chapterIndex) => ({
      chapterNumber: chapterIndex + 1,
      title: chapter.title,
      sections: chapter.sections.map((section, sectionIndex) => ({
        sectionNumber: sectionIndex + 1,
        title: section.title,
        audioUrl,
        rawText: memoir.sttRawText,
        time: section.time,
        place: section.place,
        summary: section.summary,
        pages: [section.content],
      })),
    })),
  };
}

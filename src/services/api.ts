import { BiographyBook } from "../data/sampleBiography";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
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
  const response = await fetch(getApiUrl("/api/generate-from-text"), {
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

export async function generateMemoir(
  audioBlob: Blob,
  time: string,
  place: string,
  audioUrl?: string
): Promise<BiographyBook> {
  const formData = new FormData();
  formData.append("audio", audioBlob, `recording-${Date.now()}.webm`);
  formData.append("time", time);
  formData.append("place", place);

  const response = await fetch(getApiUrl("/api/generate"), {
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

import { useCallback, useEffect, useState } from "react";
import {
  getAllEpisodes,
  initDatabase,
  saveEpisode,
  SavedEpisode,
} from "../db/autobiographyEpisodeDAO";
import { generateEpisodeFromText } from "../services/api";

type GenerateEpisodeInput = {
  sttRawText: string;
  sourceAudio?: string;
  time?: string;
  place?: string;
};

/**
 * 현재 App.tsx에는 연결하지 않은 내부 검증용 훅이다.
 * EpisodeDemoScreen에서 STT 텍스트 기반 생성/저장 파이프라인을 점검할 때 사용한다.
 */
export function useEpisodeGenerationController() {
  const [episodes, setEpisodes] = useState<SavedEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshEpisodes = useCallback(async () => {
    setEpisodes(await getAllEpisodes());
  }, []);

  useEffect(() => {
    void initDatabase()
      .then(refreshEpisodes)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "DB 초기화에 실패했습니다.");
      });
  }, [refreshEpisodes]);

  const generateAutobiography = useCallback(
    async (input: GenerateEpisodeInput | string) => {
      const { sttRawText, sourceAudio, time, place } =
        typeof input === "string" ? { sttRawText: input } : input;
      const rawText = sttRawText.trim();
      if (!rawText) {
        setError("원본 음성 텍스트가 없습니다.");
        return null;
      }

      setIsLoading(true);
      setError("");

      try {
        const generated = await generateEpisodeFromText({ sttRawText: rawText, time, place });

        await saveEpisode({
          episode_id: generated.episode.episode_id,
          title: generated.episode.title,
          content: generated.episode.content,
          stt_raw: rawText,
          source_audio: sourceAudio,
          tags: generated.episode.tags,
          stt_length: generated.metadata.stt_length,
          summary_length: generated.metadata.summary_length,
          compression_rate: generated.metadata.compression_rate,
          llm_model: generated.metadata.llm_model,
        });

        await refreshEpisodes();
        return generated;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "자서전 생성에 실패했습니다.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshEpisodes]
  );

  return { episodes, isLoading, error, generateAutobiography, refreshEpisodes };
}

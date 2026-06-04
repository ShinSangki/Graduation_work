import { useCallback, useEffect, useRef, useState } from "react";

const TTS_RATE = 0.85;
const CHUNK_PAUSE_MS = 250;

export function prepareTextForTTS(text: string): string {
  return String(text || "")
    .replace(/^#{1,6}\s?/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\bSTT\b/gi, "에스 티 티")
    .replace(/\bTTS\b/gi, "티 티 에스")
    .replace(/\bAI\b/gi, "에이 아이")
    .replace(/\bAPI\b/gi, "에이 피 아이")
    .replace(/제\s*(\d+)\s*장/g, "제 $1 장")
    .replace(/제\s*(\d+)\s*절/g, "제 $1 절")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim();
}

export function splitIntoTtsChunks(text: string): string[] {
  const prepared = prepareTextForTTS(text);
  if (!prepared) return [];

  const chunks: string[] = [];
  let current = "";

  for (const character of prepared) {
    current += character;
    if (".!?。！？".includes(character)) {
      const chunk = current.trim();
      if (chunk.length > 1) chunks.push(chunk);
      current = "";
    }
  }

  const remainder = current.trim();
  if (remainder.length > 1) chunks.push(remainder);
  return chunks;
}

function getBestKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang === "ko-KR" && voice.name.includes("Google")) ||
    voices.find((voice) => voice.lang === "ko-KR") ||
    voices.find((voice) => voice.lang.startsWith("ko")) ||
    null
  );
}

export function useKoreanTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const isSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      stop();
      const chunks = splitIntoTtsChunks(text);
      if (chunks.length === 0) return;

      const runId = runIdRef.current;
      let chunkIndex = 0;
      setIsSpeaking(true);

      function speakNext() {
        if (runId !== runIdRef.current) return;
        if (chunkIndex >= chunks.length) {
          setIsSpeaking(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
        utterance.lang = "ko-KR";
        utterance.rate = TTS_RATE;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (voiceRef.current) utterance.voice = voiceRef.current;

        utterance.onend = () => {
          chunkIndex += 1;
          timerRef.current = window.setTimeout(speakNext, CHUNK_PAUSE_MS);
        };
        utterance.onerror = () => {
          if (runId === runIdRef.current) setIsSpeaking(false);
        };
        window.speechSynthesis.speak(utterance);
      }

      speakNext();
    },
    [isSupported, stop]
  );

  useEffect(() => {
    if (!isSupported) return;

    function updateVoice() {
      voiceRef.current = getBestKoreanVoice();
    }

    updateVoice();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoice);
      stop();
    };
  }, [isSupported, stop]);

  return { isSpeaking, isSupported, speak, stop };
}

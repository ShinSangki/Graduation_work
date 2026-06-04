import { useEffect, useMemo, useState } from "react";
import { prepareTextForTTS, useKoreanTTS } from "../hooks/useKoreanTTS";

const TEST_TEXT =
  "안녕하세요. 지금 안드로이드 기기에서 한국어 음성 합성 기능을 테스트하고 있습니다.";

type VoiceInfo = {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};

function toVoiceInfo(voice: SpeechSynthesisVoice): VoiceInfo {
  return {
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    default: voice.default,
  };
}

function selectKoreanVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => voice.lang === "ko-KR" && voice.name.includes("Google")) ||
    voices.find((voice) => voice.lang === "ko-KR") ||
    voices.find((voice) => voice.lang.startsWith("ko")) ||
    null
  );
}

export function TtsTestPage() {
  const { isSpeaking, isSupported, stop } = useKoreanTTS();
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceInfo | null>(null);
  const [lastStartDelayMs, setLastStartDelayMs] = useState<number | null>(null);
  const [status, setStatus] = useState("대기 중");
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [inputText, setInputText] = useState(TEST_TEXT);

  const koreanVoices = useMemo(
    () => voices.filter((voice) => voice.lang === "ko-KR"),
    [voices]
  );

  function refreshVoices() {
    if (!isSupported) {
      setVoices([]);
      setSelectedVoice(null);
      return;
    }

    const loadedVoices = window.speechSynthesis.getVoices();
    const selected = selectKoreanVoice(loadedVoices);
    setVoices(loadedVoices.map(toVoiceInfo));
    setSelectedVoice(selected ? toVoiceInfo(selected) : null);
  }

  function addError(message: string) {
    setErrorLog((logs) => [`${new Date().toLocaleTimeString()} ${message}`, ...logs].slice(0, 8));
  }

  function speakFromUserGesture() {
    if (!isSupported) {
      addError("Web Speech API 미지원");
      return;
    }

    const text = prepareTextForTTS(inputText);
    if (!text) {
      addError("읽을 텍스트 없음");
      return;
    }

    window.speechSynthesis.cancel();
    refreshVoices();

    const startedAt = performance.now();
    const utterance = new SpeechSynthesisUtterance(text);
    const loadedVoices = window.speechSynthesis.getVoices();
    const selected = selectKoreanVoice(loadedVoices);

    utterance.lang = selected?.lang || "ko-KR";
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (selected) utterance.voice = selected;

    setLastStartDelayMs(null);
    setStatus("speak() 호출됨. onstart 대기 중");

    utterance.onstart = () => {
      const delay = Math.round(performance.now() - startedAt);
      setLastStartDelayMs(delay);
      setStatus(delay <= 300 ? "재생 시작: 300ms 이내" : "재생 시작: 300ms 초과");
    };

    utterance.onend = () => {
      setStatus("재생 완료");
    };

    utterance.onerror = (event) => {
      const message = `TTS 오류: ${event.error}`;
      setStatus(message);
      addError(message);
    };

    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!isSupported) return;

    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);

    const retryTimers = [100, 300, 700, 1200].map((delay) =>
      window.setTimeout(refreshVoices, delay)
    );

    return () => {
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>TTS Android Test</h1>

      <section>
        <h2>상태</h2>
        <p>지원 여부: {isSupported ? "지원" : "미지원"}</p>
        <p>훅 isSpeaking: {isSpeaking ? "true" : "false"}</p>
        <p>현재 상태: {status}</p>
        <p>
          onstart 지연:{" "}
          {lastStartDelayMs === null ? "아직 없음" : `${lastStartDelayMs}ms`}
        </p>
      </section>

      <section>
        <h2>선택된 음성</h2>
        <p>
          {selectedVoice
            ? `${selectedVoice.name} / ${selectedVoice.lang}`
            : "선택된 한국어 음성 없음"}
        </p>
      </section>

      <section>
        <h2>음성 목록</h2>
        <p>전체 음성 개수: {voices.length}</p>
        <p>ko-KR 음성 개수: {koreanVoices.length}</p>
        <button type="button" onClick={refreshVoices}>
          음성 목록 새로고침
        </button>

        <pre style={{ whiteSpace: "pre-wrap" }}>
          {koreanVoices.length > 0
            ? koreanVoices
                .map(
                  (voice, index) =>
                    `${index + 1}. ${voice.name} / ${voice.lang} / local=${voice.localService} / default=${voice.default}`
                )
                .join("\n")
            : "ko-KR 음성 없음"}
        </pre>
      </section>

      <section>
        <h2>터치 재생 테스트</h2>
        <textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          rows={4}
          style={{ boxSizing: "border-box", fontSize: 16, width: "100%" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={speakFromUserGesture}>
            터치해서 재생
          </button>
          <button type="button" onClick={stop}>
            정지
          </button>
        </div>
      </section>

      <section>
        <h2>에러 로그</h2>
        <pre style={{ color: "#b00020", whiteSpace: "pre-wrap" }}>
          {errorLog.length > 0 ? errorLog.join("\n") : "에러 없음"}
        </pre>
      </section>
    </main>
  );
}

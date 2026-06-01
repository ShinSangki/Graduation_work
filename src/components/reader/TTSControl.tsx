/*
 * 임시 비활성: 이전 분리형 리더 전용 컴포넌트다.
 *
type TTSControlProps = {
  isSpeaking: boolean;
  isSupported: boolean;
  onSpeak: () => void;
  onStop: () => void;
};

export function TTSControl({ isSpeaking, isSupported, onSpeak, onStop }: TTSControlProps) {
  return (
    <div className="readerControlGroup" aria-label="TTS 낭독">
      <button className="ttsPrimaryButton" onClick={onSpeak} disabled={!isSupported || isSpeaking}>
        ▶ 듣기
      </button>
      <button className="ttsStopButton" onClick={onStop} disabled={!isSupported || !isSpeaking}>
        정지
      </button>
    </div>
  );
}
*/

import { ChangeEvent, useState } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { RecordedAudio } from "../hooks/useAudioRecorder";

type RecordScreenProps = {
  onRecorded: (audio: RecordedAudio) => void;
  onBack: () => void;
  time: string;
  place: string;
};

type RecordingStatus = "ready" | "recording" | "done";

const statusContent: Record<
  RecordingStatus,
  { title: string; description: string }
> = {
  ready: {
    title: "편하게 말씀해주세요",
    description: "녹음 버튼을 눌러 이야기를 시작하세요.",
  },
  recording: {
    title: "기억을 듣고 있습니다...",
    description: "말씀을 마친 후 종료 버튼을 눌러주세요.",
  },
  done: {
    title: "녹음이 완료되었습니다",
    description: "자서전을 생성하거나 다시 녹음할 수 있습니다.",
  },
};

export function RecordScreen({ onRecorded, onBack, time, place }: RecordScreenProps) {
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>("ready");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { clearRecording, recordedAudio, selectAudioFile, startRecording, stopRecording } =
    useAudioRecorder();
  const content = statusContent[recordingStatus];

  async function handleStartRecording() {
    try {
      setError("");
      clearRecording();
      await startRecording();
      setRecordingStatus("recording");
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "마이크 권한을 확인해주세요."
      );
    }
  }

  async function handleStopRecording() {
    try {
      await stopRecording();
      setRecordingStatus("done");
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "녹음을 종료하지 못했습니다."
      );
    }
  }

  function handleBack() {
    onBack();
  }

  function resetRecording() {
    if (isUploading) return;
    clearRecording();
    setError("");
    setRecordingStatus("ready");
  }

  function handleGenerate() {
    if (!recordedAudio) {
      setError("먼저 녹음을 완료해주세요.");
      return;
    }

    setIsUploading(true);
    setError("");
    onRecorded(recordedAudio);
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      selectAudioFile(file);
      setRecordingStatus("done");
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "음성 파일을 불러오지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main
      className="screen"
      style={{ paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}
    >
      <style>{`
        @keyframes uploadSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <section className="topAppBar">
        <button className="iconButton" onClick={handleBack} aria-label="뒤로가기">
          ‹
        </button>
        <strong>음성 녹음</strong>
      </section>

      <aside
        style={{
          background: "#f0f4ff",
          borderRadius: "16px",
          color: "#6f7480",
          fontSize: "1rem",
          lineHeight: 1.6,
          marginTop: "14px",
          padding: "12px 14px",
          wordBreak: "keep-all",
        }}
      >
        💡 [{time}], [{place}]에서의 기억을 듣고 있습니다.
      </aside>

      <section
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100dvh - 220px)",
          padding: "48px 8px 24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            color:
              recordingStatus === "recording" ? "var(--primary)" : "var(--text)",
            fontSize: "2rem",
            lineHeight: 1.5,
            margin: 0,
            wordBreak: "keep-all",
          }}
        >
          {content.title}
        </h1>
        <p
          style={{
            color:
              recordingStatus === "recording" ? "var(--primary)" : "#6f7480",
            fontSize: "1.15rem",
            lineHeight: 1.65,
            margin: "10px 0 0",
            wordBreak: "keep-all",
          }}
        >
          {content.description}
        </p>

        {recordingStatus !== "recording" && (
          <label
            className="secondaryButton"
            style={{ cursor: "pointer", marginTop: "18px", padding: "12px 18px" }}
          >
            음성 파일 불러오기
            <input
              accept="audio/*"
              onChange={handleSelectFile}
              style={{ display: "none" }}
              type="file"
            />
          </label>
        )}

        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: "240px",
            justifyContent: "center",
            marginTop: "30px",
            position: "relative",
            width: "240px",
          }}
        >
          <button
            aria-label={
              recordingStatus === "done" ? "다시 녹음 준비" : "녹음 시작"
            }
            className={
              recordingStatus === "recording"
                ? "record-btn-active"
                : recordingStatus === "done"
                  ? "record-btn-done"
                  : "record-btn-ready"
            }
            disabled={isUploading}
            onClick={
              recordingStatus === "recording"
                ? handleStopRecording
                : recordingStatus === "done"
                  ? resetRecording
                  : handleStartRecording
            }
            type="button"
          >
            {recordingStatus === "done" ? "✓" : null}
          </button>
        </div>

        {recordingStatus === "done" && recordedAudio?.playbackUrl && (
          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(23, 25, 31, 0.08)",
              borderRadius: "16px",
              padding: "14px",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#6f7480",
                fontWeight: 800,
                lineHeight: 1.5,
                margin: "0 0 8px",
                textAlign: "left",
              }}
            >
              선택한 음성 미리 듣기
            </p>
            <audio
              className="previewAudio"
              controls
              preload="metadata"
              src={recordedAudio.playbackUrl}
              style={{ display: "block", width: "100%" }}
            >
              브라우저가 오디오 재생을 지원하지 않습니다.
            </audio>
          </div>
        )}

        {error && <p className="errorText">{error}</p>}
      </section>

      {recordingStatus !== "ready" && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.97)",
            borderTop: "1px solid rgba(23, 25, 31, 0.08)",
            bottom: 0,
            boxShadow: "0 -8px 24px rgba(38, 48, 75, 0.1)",
            boxSizing: "border-box",
            left: 0,
            padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
            position: "fixed",
            width: "100%",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              margin: "0 auto",
              maxWidth: "520px",
            }}
          >
            {recordingStatus === "recording" ? (
              <button
                className="dangerButton"
                onClick={handleStopRecording}
                style={{ flex: 1, fontSize: "1.25rem", minHeight: "60px" }}
                type="button"
              >
                ■ 녹음 종료
              </button>
            ) : (
              <>
                <button
                  className="secondaryButton"
                  disabled={isUploading}
                  onClick={resetRecording}
                  style={{ flex: 1, fontSize: "1.05rem", minHeight: "60px" }}
                  type="button"
                >
                  다시 녹음하기
                </button>
                <button
                  className="primaryButton"
                  disabled={!recordedAudio || isUploading}
                  onClick={handleGenerate}
                  style={{ flex: 1, fontSize: "1.05rem", minHeight: "60px" }}
                  type="button"
                >
                  {isUploading ? (
                    <span
                      style={{
                        alignItems: "center",
                        display: "inline-flex",
                        gap: "8px",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          animation: "uploadSpin 0.9s linear infinite",
                          border: "3px solid rgba(255,255,255,0.4)",
                          borderRadius: "50%",
                          borderTopColor: "#fff",
                          height: "16px",
                          width: "16px",
                        }}
                      />
                      업로드 중
                    </span>
                  ) : (
                    "자서전 생성"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

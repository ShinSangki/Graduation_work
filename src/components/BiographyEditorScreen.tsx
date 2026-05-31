import { useEffect, useMemo, useState } from "react";

export type EditorData = {
  chapterTitle: string;
  sectionTitle: string;
  time?: string;
  place?: string;
  summary?: string;
  body: string;
};

type BiographyEditorScreenProps = {
  initialData: EditorData;
  onSave: (updatedData: EditorData) => void;
  onCancel: () => void;
  isSaving?: boolean;
  audioUrl?: string;
  rawText?: string;
};

const fieldStyle = {
  background: "#ffffff",
  border: "1px solid rgba(23, 25, 31, 0.12)",
  borderRadius: "14px",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "16px",
  lineHeight: 1.5,
  padding: "12px 14px",
  width: "100%",
};

function normalizeData(data: EditorData) {
  return {
    chapterTitle: data.chapterTitle,
    sectionTitle: data.sectionTitle,
    time: data.time ?? "",
    place: data.place ?? "",
    summary: data.summary ?? "",
    body: data.body,
  };
}

export function BiographyEditorScreen({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  audioUrl,
  rawText,
}: BiographyEditorScreenProps) {
  const [data, setData] = useState<EditorData>(() => ({ ...initialData }));
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    setData({ ...initialData });
  }, [initialData]);

  const isDirty = useMemo(
    () =>
      JSON.stringify(normalizeData(data)) !==
      JSON.stringify(normalizeData(initialData)),
    [data, initialData]
  );
  const isValid =
    data.chapterTitle.trim() !== "" &&
    data.sectionTitle.trim() !== "" &&
    data.body.trim() !== "";
  const canSave = isDirty && isValid && !isSaving;

  function updateField(field: keyof EditorData, value: string) {
    setData((currentData) => ({ ...currentData, [field]: value }));
  }

  function handleCancel() {
    if (
      isDirty &&
      !window.confirm("수정 중인 내용이 있습니다. 정말 나가시겠습니까?")
    ) {
      return;
    }
    onCancel();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) onSave(data);
  }

  return (
    <main
      className="screen"
      style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))" }}
    >
      <section
        className="topAppBar"
        style={{
          background: "rgba(246, 247, 251, 0.96)",
          gridTemplateColumns: "64px minmax(0, 1fr) 64px",
          textAlign: "center",
        }}
      >
        <button className="textButton" disabled={isSaving} onClick={handleCancel} type="button">
          취소
        </button>
        <strong>기억 수정하기</strong>
        <button
          className="textButton"
          disabled={!canSave}
          form="biography-editor-form"
          style={{ color: canSave ? "var(--primary)" : "var(--muted)" }}
          type="submit"
        >
          {isSaving ? "저장 중" : "저장"}
        </button>
      </section>

      <form id="biography-editor-form" onSubmit={handleSubmit}>
        <section className="simplePanel" style={{ display: "grid", gap: "16px" }}>
          <div>
            <label htmlFor="chapterTitle" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
              장 제목
            </label>
            <input
              id="chapterTitle"
              onChange={(event) => updateField("chapterTitle", event.target.value)}
              style={fieldStyle}
              value={data.chapterTitle}
            />
          </div>

          <div>
            <label htmlFor="sectionTitle" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
              소제목
            </label>
            <input
              id="sectionTitle"
              onChange={(event) => updateField("sectionTitle", event.target.value)}
              style={fieldStyle}
              value={data.sectionTitle}
            />
          </div>
          <button
            className="secondaryButton"
            disabled={!rawText}
            onClick={() => setShowRawText((visible) => !visible)}
            type="button"
          >
            {showRawText ? "원문 닫기" : "원문 보기"}
          </button>
          {showRawText && rawText && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid rgba(23, 25, 31, 0.1)",
                borderRadius: "14px",
                lineHeight: 1.7,
                maxHeight: "280px",
                overflowY: "auto",
                padding: "14px",
                whiteSpace: "pre-wrap",
              }}
            >
              {rawText}
            </div>
          )}
        </section>

        <section className="simplePanel" style={{ display: "grid", gap: "16px" }}>
          <p className="eyebrow" style={{ marginBottom: 0 }}>메타데이터</p>
          <div>
            <label htmlFor="time" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
              시기
            </label>
            <input
              id="time"
              onChange={(event) => updateField("time", event.target.value)}
              placeholder="예: 1970년대, 초등학교 시절"
              style={fieldStyle}
              value={data.time ?? ""}
            />
          </div>

          <div>
            <label htmlFor="place" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
              장소
            </label>
            <input
              id="place"
              onChange={(event) => updateField("place", event.target.value)}
              placeholder="예: 부산 영도구 골목길"
              style={fieldStyle}
              value={data.place ?? ""}
            />
          </div>

          <div>
            <label htmlFor="summary" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
              요약
            </label>
            <textarea
              id="summary"
              onChange={(event) => updateField("summary", event.target.value)}
              placeholder="예: 친구들과 골목에서 뛰어놀던 어린 시절의 기억"
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
              value={data.summary ?? ""}
            />
          </div>
        </section>

        <section className="simplePanel">
          {audioUrl ? (
            <audio
              controls
              preload="metadata"
              src={audioUrl}
              style={{ marginBottom: "18px", width: "100%" }}
            >
              브라우저가 오디오 재생을 지원하지 않습니다.
            </audio>
          ) : (
            <p
              className="mutedText"
              style={{
                background: "#edf1f7",
                borderRadius: "14px",
                marginBottom: "18px",
                padding: "12px 14px",
              }}
            >
              원본 음성 파일이 없습니다.
            </p>
          )}
          {/* Original recording stays visible while the body is edited. */}
          <label htmlFor="body" style={{ display: "block", fontWeight: 800, marginBottom: "7px" }}>
            본문
          </label>
          <textarea
            id="body"
            onChange={(event) => updateField("body", event.target.value)}
            rows={16}
            style={{ ...fieldStyle, minHeight: "320px", resize: "vertical" }}
            value={data.body}
          />
          <p
            className="mutedText"
            style={{ fontSize: "14px", marginTop: "8px", textAlign: "right" }}
          >
            {data.body.length.toLocaleString()} 자
          </p>
        </section>
      </form>
    </main>
  );
}

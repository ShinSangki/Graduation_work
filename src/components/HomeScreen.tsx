import { MemoirSummary } from "../hooks/useMemoirDB";
import memoryBookLogo from "../assets/memory-book-logo.png";

type HomeScreenProps = {
  onStartRecord: () => void;
  onStartRecordFirst: () => void;
  onOpenLibrary: () => void;
  onReadRecent: (bookId: string) => void;
  onCreateDemoData: () => void;
  recentMemoir: MemoirSummary | null;
};

export function HomeScreen({
  onStartRecord,
  onStartRecordFirst,
  onOpenLibrary,
  onReadRecent,
  onCreateDemoData,
  recentMemoir,
}: HomeScreenProps) {
  return (
    <main
      style={{
        background: "#f7f8fc",
        boxSizing: "border-box",
        color: "#1f2937",
        minHeight: "100dvh",
        padding: "40px 20px calc(210px + env(safe-area-inset-bottom))",
      }}
    >
      <button
        aria-label="시연용 더미데이터 생성"
        onClick={onCreateDemoData}
        style={{
          background: "transparent",
          border: 0,
          boxShadow: "none",
          height: "56px",
          minHeight: 0,
          opacity: 0,
          padding: 0,
          position: "fixed",
          right: 0,
          top: "env(safe-area-inset-top)",
          width: "56px",
          zIndex: 20,
        }}
        type="button"
      />
      <div style={{ margin: "0 auto", maxWidth: "520px" }}>
        <header style={{ textAlign: "center" }}>
          <img
            alt="기억책 로고"
            aria-label="나의 기억책 로고"
            style={{
              borderRadius: "26px",
              display: "block",
              height: "156px",
              margin: "0 auto 16px",
              objectFit: "contain",
              overflow: "hidden",
              width: "144px",
            }}
            src={memoryBookLogo}
          />
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: "bold",
              lineHeight: 1.5,
              margin: "0",
            }}
          >
            나의 기억책
          </h1>
          <p
            style={{
              color: "#666",
              fontSize: "1.2rem",
              lineHeight: 1.6,
              margin: "8px 0 0",
              wordBreak: "keep-all",
            }}
          >
            말로 남긴 기억이 한 권의 자서전이 됩니다.
          </p>
        </header>

        <section style={{ marginTop: "52px" }} aria-label="최근 자서전">
          <button
            onClick={() =>
              recentMemoir ? onReadRecent(recentMemoir.id) : onStartRecord()
            }
            style={{
              background: "#fff",
              border: "1px solid rgba(36, 107, 254, 0.12)",
              borderRadius: "20px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              color: "#1f2937",
              cursor: "pointer",
              minHeight: "170px",
              padding: "24px",
              textAlign: "left",
              width: "100%",
            }}
            type="button"
          >
            <span
              style={{
                color: "#246bfe",
                display: "block",
                fontSize: "1rem",
                fontWeight: "bold",
                lineHeight: 1.5,
              }}
            >
              {recentMemoir ? "최근 자서전" : "첫 자서전 만들기"}
            </span>
            <strong
              style={{
                display: "block",
                fontSize: "1.5rem",
                fontWeight: 600,
                lineHeight: 1.5,
                marginTop: "8px",
              }}
            >
              {recentMemoir?.title || "아직 작성된 자서전이 없습니다"}
            </strong>
            <span
              style={{
                color: "#888",
                display: "block",
                fontSize: "1.05rem",
                lineHeight: 1.6,
                marginTop: "8px",
              }}
            >
              {recentMemoir
                ? "읽던 위치부터 이어서 확인할 수 있어요."
                : "녹음을 시작하면 나만의 기억책을 만들 수 있어요."}
            </span>
          </button>
        </section>
      </div>

      <button
        aria-label="바로 녹음 시작"
        className="record-btn-ready homeRecordButton"
        onClick={onStartRecordFirst}
        type="button"
      />

      <nav
        aria-label="주요 메뉴"
        style={{
          background: "rgba(255,255,255,0.96)",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          bottom: 0,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
          boxSizing: "border-box",
          left: 0,
          padding: "14px 20px calc(14px + env(safe-area-inset-bottom))",
          position: "fixed",
          width: "100%",
        }}
      >
        <div style={{ display: "grid", gap: "10px", margin: "0 auto", maxWidth: "520px" }}>
          <button
            onClick={onOpenLibrary}
            style={{
              background: "#fff",
              border: "1px solid #cbd5e1",
              borderRadius: "16px",
              color: "#273044",
              cursor: "pointer",
              fontSize: "1.15rem",
              fontWeight: "bold",
              lineHeight: 1.5,
              minHeight: "58px",
            }}
            type="button"
          >
            보관함 보기
          </button>
        </div>
      </nav>
    </main>
  );
}

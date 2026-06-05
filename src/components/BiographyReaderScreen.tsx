import {
  type DragEvent,
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BiographyBook,
  ReaderPage,
  buildReaderPages,
  formatKoreanDate,
} from "../data/sampleBiography";
import { useKoreanTTS } from "../hooks/useKoreanTTS";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

type BiographyReaderScreenProps = {
  book: BiographyBook;
  onBack: () => void;
  onEdit: (chapterNumber: number, sectionNumber: number) => void;
  onReorderChapters: (chapters: BiographyBook["chapters"]) => void;
  onDeleteChapter: (chapterNumber: number) => void;
  onUpdateCover: (coverImage: string) => Promise<void>;
  onCreateEpisode: (method: "record" | "upload" | "text") => void;
};

const SWIPE_THRESHOLD = 50;

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getStoredPageIndex(key: string, lastPageIndex: number) {
  const stored = Number(window.localStorage.getItem(key));
  if (!Number.isInteger(stored)) return 0;
  return Math.min(Math.max(stored, 0), lastPageIndex);
}

function formatRecordedDate(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split(".");
  if (!year || !month || !day) return "";
  return `${year.slice(-2)}년 ${Number(month)}월 ${Number(day)}일`;
}

function getPageLabel(page: ReaderPage) {
  if (page.type === "cover") return "[표지]";
  if (page.type === "toc") return "[목차]";
  return `[제${page.chapterNumber}장 ${page.chapterTitle} - ${page.sectionTitle}]`;
}

function getCompactPageLabel(pageIndex: number, totalPages: number) {
  return `${pageIndex + 1}/${totalPages}`;
}

export function BiographyReaderScreen({
  book,
  onBack,
  onEdit,
  onReorderChapters,
  onDeleteChapter,
  onUpdateCover,
  onCreateEpisode,
}: BiographyReaderScreenProps) {
  const [orderedChapters, setOrderedChapters] = useState(book.chapters);
  const orderedChaptersRef = useRef(book.chapters);
  const draggedChapterIndex = useRef<number | null>(null);
  const readerBook = useMemo(() => ({ ...book, chapters: orderedChapters }), [book, orderedChapters]);
  const pages = useMemo(() => buildReaderPages(readerBook), [readerBook]);
  const lastPageKey = `biography_last_page_${book.id}`;
  const [currentPageIndex, setCurrentPageIndex] = useState(() =>
    getStoredPageIndex(lastPageKey, pages.length - 1)
  );
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isSpeaking, isSupported: isTtsSupported, speak, stop } = useKoreanTTS();

  const totalPages = pages.length;
  const page: ReaderPage = pages[currentPageIndex];
  const progress = ((currentPageIndex + 1) / totalPages) * 100;

  function moveChapter(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...orderedChaptersRef.current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    orderedChaptersRef.current = next;
    setOrderedChapters(next);
    draggedChapterIndex.current = toIndex;
  }

  function commitChapterOrder() {
    if (draggedChapterIndex.current === null) return;
    draggedChapterIndex.current = null;
    onReorderChapters(
      orderedChaptersRef.current.map((chapter, index) => ({
        ...chapter,
        chapterNumber: index + 1,
      }))
    );
  }

  function handleChapterDragStart(event: DragEvent<HTMLButtonElement>, index: number) {
    draggedChapterIndex.current = index;
    event.dataTransfer.effectAllowed = "move";
  }

  function handleChapterTouchMove(event: TouchEvent<HTMLButtonElement>) {
    const touch = event.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest("[data-chapter-index]");
    const targetIndex = Number(target?.getAttribute("data-chapter-index"));
    if (draggedChapterIndex.current !== null && Number.isInteger(targetIndex)) {
      moveChapter(draggedChapterIndex.current, targetIndex);
    }
  }

  function handleDeleteChapter(chapterNumber: number, title: string) {
    if (!window.confirm(`"${title}" 목차와 연결된 녹음 기록을 삭제할까요?`)) return;
    onDeleteChapter(chapterNumber);
  }

  useEffect(() => {
    orderedChaptersRef.current = book.chapters;
    setOrderedChapters(book.chapters);
  }, [book.chapters]);

  function stopAudio() {
    stop();
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  function goToPage(index: number) {
    stopAudio();
    setShowPagePicker(false);
    const nextIndex = Math.min(Math.max(index, 0), totalPages - 1);
    setSlideDirection(nextIndex < currentPageIndex ? "right" : "left");
    setCurrentPageIndex(nextIndex);
  }

  function goNext() {
    if (currentPageIndex === totalPages - 1) {
      stopAudio();
      onBack();
      return;
    }
    goToPage(currentPageIndex + 1);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return;

    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - touchStart.current.x;
    const distanceY = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (
      Math.abs(distanceX) < SWIPE_THRESHOLD ||
      Math.abs(distanceX) <= Math.abs(distanceY)
    ) {
      return;
    }

    if (distanceX > 0) {
      if (currentPageIndex > 0) goToPage(currentPageIndex - 1);
      return;
    }
    goNext();
  }

  function moveToChapter(chapterNumber: number) {
    const index = pages.findIndex(
      (item) => item.type === "body" && item.chapterNumber === chapterNumber
    );
    if (index >= 0) goToPage(index);
  }

  function goToToc() {
    goToPage(1);
  }

  function readWithTts() {
    if (page.type !== "body") return;
    if (isSpeaking) {
      stop();
      return;
    }
    speak(page.body);
  }

  function handleEdit() {
    if (page.type !== "body") return;
    onEdit(page.chapterNumber, page.sectionNumber);
  }

  async function updateCover(source: CameraSource) {
    const image = await Camera.getPhoto({
      quality: 78,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
    });
    if (image.dataUrl) await onUpdateCover(image.dataUrl);
  }

  async function handleCoverClick() {
    try {
      const useCamera = window.confirm("카메라로 촬영할까요?\n취소를 누르면 갤러리에서 선택합니다.");
      await updateCover(useCamera ? CameraSource.Camera : CameraSource.Photos);
    } catch (coverError) {
      console.error("Cover image selection failed.", coverError);
    }
  }

  function handleCreateEpisode(method: "record" | "upload" | "text") {
    setShowCreateMenu(false);
    onCreateEpisode(method);
  }

  useEffect(() => {
    stopAudio();
    window.localStorage.setItem(lastPageKey, String(currentPageIndex));
    window.scrollTo({ top: 0 });
  }, [currentPageIndex, lastPageKey]);

  useEffect(() => () => stopAudio(), []);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 360);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const swipeArea = swipeAreaRef.current;
    if (!swipeArea) return;

    function preventHorizontalScroll(event: globalThis.TouchEvent) {
      if (!touchStart.current) return;

      const touch = event.changedTouches[0];
      const distanceX = touch.clientX - touchStart.current.x;
      const distanceY = touch.clientY - touchStart.current.y;
      if (event.cancelable && Math.abs(distanceX) > Math.abs(distanceY)) event.preventDefault();
    }

    swipeArea.addEventListener("touchmove", preventHorizontalScroll, { passive: false });
    return () => swipeArea.removeEventListener("touchmove", preventHorizontalScroll);
  }, [currentPageIndex]);

  function renderPage() {
    if (page.type === "cover") {
      return (
        <button
          type="button"
          onClick={handleCoverClick}
          aria-label="표지 사진 변경"
          className="simplePanel"
          style={{
            backgroundImage: book.coverImage
              ? `linear-gradient(rgba(0,0,0,0.38), rgba(0,0,0,0.38)), url("${book.coverImage}")`
              : undefined,
            backgroundPosition: "center",
            backgroundSize: "cover",
            color: book.coverImage ? "#fff" : undefined,
            minHeight: "calc(100dvh - 184px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <p className="eyebrow" style={{ color: book.coverImage ? "#fff" : undefined }}>Legacy Archive</p>
          <h1>{book.title}</h1>
          {book.subtitle && <p className="mutedText" style={{ color: book.coverImage ? "#fff" : undefined }}>{book.subtitle}</p>}
          <p className="mutedText" style={{ color: book.coverImage ? "#fff" : undefined }}>{formatKoreanDate(book.createdAt)}</p>
          <p className="mutedText" style={{ color: book.coverImage ? "#fff" : undefined }}>표지를 눌러 사진 변경</p>
        </button>
      );
    }

    if (page.type === "toc") {
      return (
        <section className="simplePanel">
          <div style={{ alignItems: "center", display: "flex", gap: "10px", justifyContent: "space-between" }}>
            <div>
              <p className="eyebrow">Contents</p>
              <h1>목차</h1>
            </div>
            <button
              className="iconButton"
              onClick={() => setShowCreateMenu((visible) => !visible)}
              style={{ color: "#007AFF", fontSize: "0.82rem", fontWeight: "bold", padding: "0 8px", width: "56px" }}
              type="button"
            >
              추가
            </button>
          </div>
          {showCreateMenu && (
            <div className="selectionPanel">
              <button className="secondaryButton" onClick={() => handleCreateEpisode("record")} type="button">
                음성 녹음
              </button>
              <button className="secondaryButton" onClick={() => handleCreateEpisode("upload")} type="button">
                음성 업로드
              </button>
              <button className="secondaryButton" onClick={() => handleCreateEpisode("text")} type="button">
                텍스트 작성
              </button>
            </div>
          )}
          <p className="mutedText">☰ 버튼을 끌어서 순서를 바꾸거나, 삭제 버튼으로 녹음 기록을 지울 수 있습니다.</p>
          <div
            className="buttonStack"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {orderedChapters.map((chapter, index) => (
              <div
                data-chapter-index={index}
                key={`${chapter.chapterNumber}-${chapter.title}`}
                onDragEnter={() => {
                  if (draggedChapterIndex.current !== null) {
                    moveChapter(draggedChapterIndex.current, index);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 56px 56px" }}
              >
                <button
                  className="secondaryButton"
                  onClick={() => moveToChapter(chapter.chapterNumber)}
                  style={{ minHeight: "56px", textAlign: "left" }}
                >
                  {index + 1}. {chapter.title}
                </button>
                <button
                  aria-label={`${chapter.title} 순서 변경`}
                  className="secondaryButton"
                  draggable
                  onDragEnd={commitChapterOrder}
                  onDragStart={(event) => handleChapterDragStart(event, index)}
                  onTouchEnd={(event) => {
                    event.stopPropagation();
                    commitChapterOrder();
                  }}
                  onTouchMove={(event) => {
                    event.stopPropagation();
                    handleChapterTouchMove(event);
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation();
                    draggedChapterIndex.current = index;
                  }}
                  style={{ cursor: "grab", fontSize: "1.4rem", padding: 0, touchAction: "none" }}
                  type="button"
                >
                  ☰
                </button>
                <button
                  aria-label={`${chapter.title} 삭제`}
                  className="secondaryButton"
                  disabled={orderedChapters.length <= 1}
                  onClick={() => handleDeleteChapter(chapter.chapterNumber, chapter.title)}
                  style={{ color: "var(--danger)", fontSize: "0.9rem", padding: 0 }}
                  type="button"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </section>
      );
    }

    return (
      <article>
        <header
          style={{
            background: "rgba(255, 255, 255, 0.72)",
            borderBottom: "1px solid rgba(23, 25, 31, 0.08)",
            borderTop: "1px solid rgba(23, 25, 31, 0.08)",
            margin: "0 -16px 16px",
            padding: "10px 16px",
          }}
        >
          <h1 style={{ fontSize: "24px", lineHeight: 1.3, margin: 0 }}>
            {page.chapterTitle}
            <br />
            <span style={{ fontSize: "0.7em" }}>{page.sectionTitle}</span>
          </h1>
          {(book.recordedAt || page.time || page.place) && (
            <p className="mutedText" style={{ fontSize: "14px", marginTop: "6px" }}>
              {book.recordedAt && `${formatRecordedDate(book.recordedAt)} 녹음`}
              {page.time && `${book.recordedAt ? " · " : ""}${page.time}`}
              {page.place && `${book.recordedAt || page.time ? " · " : ""}${page.place}`}
            </p>
          )}
        </header>

        <audio ref={audioRef} key={currentPageIndex} />

        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "20px",
            lineHeight: 1.8,
            marginTop: "24px",
            paddingBottom: "72px",
          }}
        >
          {splitSentences(page.body).map((sentence, index) => (
            <p key={index} style={{ margin: "0 0 14px" }}>
              {sentence}
            </p>
          ))}
        </div>
      </article>
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "calc(62px + max(16px, env(safe-area-inset-top))) 16px calc(122px + max(12px, env(safe-area-inset-bottom)))",
      }}
    >
      <style>{`
        @keyframes readerFadeIn {
          from { opacity: 0.45; transform: translateX(var(--reader-slide-from)); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        style={{
          background: "rgba(246, 247, 251, 0.96)",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          zIndex: 100,
        }}
      >
        {showPagePicker && (
          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(23, 25, 31, 0.12)",
              borderRadius: "14px",
              bottom: "116px",
              boxShadow: "0 10px 28px rgba(38, 48, 75, 0.18)",
              display: "flex",
              flexDirection: "column",
              left: "50%",
              maxHeight: "220px",
              maxWidth: "420px",
              overflowY: "auto",
              padding: "6px",
              position: "fixed",
              transform: "translateX(-50%)",
              width: "calc(100% - 32px)",
              zIndex: 101,
            }}
          >
            {pages.map((item, index) => (
              <button
                key={index}
                aria-current={index === currentPageIndex ? "page" : undefined}
                onClick={() => goToPage(index)}
                style={{
                  background: index === currentPageIndex ? "#e8f0ff" : "#fff",
                  border: 0,
                  borderRadius: "8px",
                  color: index === currentPageIndex ? "#246bfe" : "var(--text)",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: index === currentPageIndex ? 800 : 600,
                  lineHeight: 1.4,
                  minHeight: "44px",
                  padding: "8px 10px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                {getPageLabel(item)}
              </button>
            ))}
          </div>
        )}
        <div
          style={{
            borderBottom: "1px solid rgba(23, 25, 31, 0.06)",
            height: "max(16px, env(safe-area-inset-top))",
          }}
          aria-hidden="true"
        />
        <section
          className="topAppBar"
          style={{
            gridTemplateColumns: "46px minmax(0, 1fr) 46px",
            minHeight: "54px",
            padding: "4px 16px",
            textAlign: "center",
          }}
        >
          <button className="iconButton" onClick={onBack} aria-label="뒤로가기">
            ‹
          </button>
          <strong
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {book.title}
          </strong>
          {page.type === "body" ? (
            <button
              className="iconButton"
              onClick={handleEdit}
              style={{
                color: "#007AFF",
                fontSize: "1rem",
                fontWeight: "bold",
                padding: "0 8px",
                width: "46px",
              }}
            >
              수정
            </button>
          ) : currentPageIndex !== 1 ? (
            <button
              className="iconButton"
              onClick={goToToc}
              style={{
                color: "#007AFF",
                fontSize: "0.9rem",
                fontWeight: "bold",
                padding: "0 8px",
                width: "46px",
              }}
              type="button"
            >
              목차
            </button>
          ) : (
            <div aria-hidden="true" />
          )}
        </section>
      </div>

      <div style={{ overflow: "hidden" }}>
        <div
          key={currentPageIndex}
          ref={swipeAreaRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            "--reader-slide-from": slideDirection === "left" ? "100%" : "-100%",
            animation: "readerFadeIn 0.32s ease-out",
            touchAction: "pan-y",
          } as React.CSSProperties}
        >
          {renderPage()}
        </div>
      </div>

      {showScrollTop && (
        <button
          aria-label="맨 위로 이동"
          className="iconButton"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            bottom: "calc(136px + max(12px, env(safe-area-inset-bottom)))",
            position: "fixed",
            right: "18px",
            zIndex: 102,
          }}
          type="button"
        >
          ▲
        </button>
      )}

      <div
        style={{
          background: "rgba(255, 255, 255, 0.96)",
          borderTop: "1px solid rgba(23, 25, 31, 0.08)",
          bottom: 0,
          boxShadow: "0 -8px 24px rgba(38, 48, 75, 0.1)",
          left: 0,
          position: "fixed",
          width: "100%",
          zIndex: 100,
        }}
      >
        <div
          style={{
            backgroundColor: "#246bfe",
            height: "3px",
            left: 0,
            position: "absolute",
            top: 0,
            width: `${progress}%`,
          }}
        />
        <div
          style={{
            borderBottom: "1px solid rgba(23, 25, 31, 0.08)",
            padding: "6px 12px",
          }}
        >
          <button
            className="primaryButton"
            disabled={page.type !== "body" || !isTtsSupported}
            onClick={readWithTts}
            style={{ minHeight: "48px", width: "100%" }}
          >
            {isSpeaking ? "낭독 중지" : "읽어주기"}
          </button>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "grid",
            gridTemplateColumns: "minmax(58px, 1fr) auto auto minmax(72px, 1fr)",
            gap: "10px",
            margin: 0,
            padding: "8px 12px",
          }}
        >
          <button
            className="secondaryButton"
            disabled={currentPageIndex === 0}
            onClick={() => goToPage(currentPageIndex - 1)}
            style={{
              fontSize: "14px",
              justifySelf: "start",
              minHeight: "48px",
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
          >
            이전
          </button>
          <button
            className="secondaryButton"
            disabled={currentPageIndex === 1}
            onClick={goToToc}
            style={{
              fontSize: "14px",
              justifySelf: "center",
              minHeight: "48px",
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
            type="button"
          >
            목차
          </button>
          <button
            aria-expanded={showPagePicker}
            aria-label="페이지 선택"
            className="secondaryButton"
            onClick={() => setShowPagePicker((visible) => !visible)}
            style={{
              fontSize: "14px",
              justifySelf: "center",
              minHeight: "48px",
              padding: "8px 12px",
              whiteSpace: "nowrap",
              width: "86px",
            }}
            type="button"
          >
            {getCompactPageLabel(currentPageIndex, totalPages)}
          </button>
          <button
            className="primaryButton"
            onClick={goNext}
            style={{
              fontSize: "14px",
              justifySelf: "end",
              minHeight: "48px",
              minWidth: currentPageIndex === totalPages - 1 ? "104px" : undefined,
              padding: "8px 12px",
              whiteSpace: "nowrap",
            }}
          >
            {currentPageIndex === totalPages - 1 ? "보관함으로 이동" : "다음"}
          </button>
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(23, 25, 31, 0.06)",
            height: "max(12px, env(safe-area-inset-bottom))",
          }}
          aria-hidden="true"
        />
      </div>
    </main>
  );
}

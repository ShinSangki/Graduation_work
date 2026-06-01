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

type BiographyReaderScreenProps = {
  book: BiographyBook;
  onBack: () => void;
  onEdit: (chapterNumber: number, sectionNumber: number) => void;
  onReorderChapters: (chapters: BiographyBook["chapters"]) => void;
  onDeleteChapter: (chapterNumber: number) => void;
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

export function BiographyReaderScreen({
  book,
  onBack,
  onEdit,
  onReorderChapters,
  onDeleteChapter,
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
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    window.speechSynthesis?.cancel();
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

  function readWithTts() {
    if (page.type !== "body" || !("speechSynthesis" in window)) return;
    stopAudio();
    const utterance = new SpeechSynthesisUtterance(page.body);
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function handleEdit() {
    if (page.type !== "body") return;
    onEdit(page.chapterNumber, page.sectionNumber);
  }

  useEffect(() => {
    stopAudio();
    window.localStorage.setItem(lastPageKey, String(currentPageIndex));
    window.scrollTo({ top: 0 });
  }, [currentPageIndex, lastPageKey]);

  useEffect(() => () => stopAudio(), []);

  useEffect(() => {
    const swipeArea = swipeAreaRef.current;
    if (!swipeArea) return;

    function preventHorizontalScroll(event: globalThis.TouchEvent) {
      if (!touchStart.current) return;

      const touch = event.changedTouches[0];
      const distanceX = touch.clientX - touchStart.current.x;
      const distanceY = touch.clientY - touchStart.current.y;
      if (Math.abs(distanceX) > Math.abs(distanceY)) event.preventDefault();
    }

    swipeArea.addEventListener("touchmove", preventHorizontalScroll, { passive: false });
    return () => swipeArea.removeEventListener("touchmove", preventHorizontalScroll);
  }, [currentPageIndex]);

  function renderPage() {
    if (page.type === "cover") {
      return (
        <section
          className="simplePanel"
          style={{
            minHeight: "calc(100dvh - 184px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <p className="eyebrow">Legacy Archive</p>
          <h1>{book.title}</h1>
          {book.subtitle && <p className="mutedText">{book.subtitle}</p>}
          <p className="mutedText">{formatKoreanDate(book.createdAt)}</p>
        </section>
      );
    }

    if (page.type === "toc") {
      return (
        <section className="simplePanel">
          <p className="eyebrow">Contents</p>
          <h1>목차</h1>
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
          {book.recordedAt && (
            <p className="mutedText" style={{ fontSize: "14px", marginTop: "6px" }}>
              {formatRecordedDate(book.recordedAt)} 녹음
            </p>
          )}
        </header>

        {(page.time || page.place) && (
          <div
            className="simplePanel"
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "18px",
              minHeight: "56px",
              padding: "12px",
            }}
          >
            {page.time && <span className="eyebrow">#{page.time}</span>}
            {page.place && <span className="eyebrow">#{page.place}</span>}
          </div>
        )}

        <audio ref={audioRef} key={currentPageIndex} />

        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "20px",
            lineHeight: 1.8,
            marginTop: "24px",
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
        padding: "calc(62px + max(16px, env(safe-area-inset-top))) 16px calc(142px + max(16px, env(safe-area-inset-bottom)))",
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
              bottom: "132px",
              boxShadow: "0 10px 28px rgba(38, 48, 75, 0.18)",
              display: "flex",
              flexDirection: "column",
              left: "50%",
              maxHeight: "220px",
              maxWidth: "180px",
              overflowY: "auto",
              padding: "6px",
              position: "fixed",
              transform: "translateX(-50%)",
              width: "calc(100% - 32px)",
              zIndex: 101,
            }}
          >
            {pages.map((_item, index) => (
              <button
                key={index}
                onClick={() => goToPage(index)}
                style={{
                  background: index === currentPageIndex ? "#e8f0ff" : "#fff",
                  border: 0,
                  borderRadius: "8px",
                  color: index === currentPageIndex ? "#246bfe" : "var(--text)",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: index === currentPageIndex ? 800 : 600,
                  minHeight: "34px",
                  padding: "6px 10px",
                  textAlign: "center",
                  width: "100%",
                }}
                type="button"
              >
                {index + 1} / {totalPages}
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
            padding: "8px 12px",
          }}
        >
          <button
            className="primaryButton"
            disabled={page.type !== "body"}
            onClick={readWithTts}
            style={{ width: "100%" }}
          >
            TTS 읽기
          </button>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            margin: 0,
            padding: "6px 12px",
          }}
        >
          <button
            className="secondaryButton"
            disabled={currentPageIndex === 0}
            onClick={() => goToPage(currentPageIndex - 1)}
            style={{ justifySelf: "start" }}
          >
            이전
          </button>
          <button
            aria-expanded={showPagePicker}
            aria-label="페이지 선택"
            className="secondaryButton"
            onClick={() => setShowPagePicker((visible) => !visible)}
            style={{
              fontSize: "14px",
              justifySelf: "center",
              minHeight: "36px",
              padding: "6px 10px",
              width: "72px",
            }}
            type="button"
          >
            {currentPageIndex + 1} / {totalPages}
          </button>
          <button className="primaryButton" onClick={goNext} style={{ justifySelf: "end" }}>
            {currentPageIndex === totalPages - 1 ? "보관함으로" : "다음"}
          </button>
        </div>
        <div
          style={{
            borderTop: "1px solid rgba(23, 25, 31, 0.06)",
            height: "max(16px, env(safe-area-inset-bottom))",
          }}
          aria-hidden="true"
        />
      </div>
    </main>
  );
}

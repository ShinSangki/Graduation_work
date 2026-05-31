import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BiographyBook,
  ReaderPage,
  buildReaderPages,
} from "../../data/sampleBiography";
import { BookCover } from "./BookCover";
import { BookPage } from "./BookPage";
import { FontSizeControl } from "./FontSizeControl";
import { PageNavigation } from "./PageNavigation";
import { TableOfContents } from "./TableOfContents";
import { TTSControl } from "./TTSControl";

const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 20;
const FONT_SIZE_KEY = "biography_font_size";

type BiographyReaderProps = {
  book: BiographyBook;
  onBack: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStoredNumber(key: string, fallback: number) {
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;

  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPageText(book: BiographyBook, page: ReaderPage) {
  if (page.type === "cover") {
    return `${book.title}. ${book.subtitle ?? ""}. ${book.createdAt} 생성.`;
  }

  if (page.type === "toc") {
    return `목차. ${book.chapters
      .map((chapter) => `제${chapter.chapterNumber}장 ${chapter.title}`)
      .join(". ")}`;
  }

  return `제${page.chapterNumber}장 ${page.chapterTitle}. ${page.sectionNumber}절 ${page.sectionTitle}. ${page.body}`;
}

export function BiographyReader({ book, onBack }: BiographyReaderProps) {
  const pages = useMemo(() => buildReaderPages(book), [book]);
  const lastPageKey = `biography_last_page_${book.id}`;
  const touchStartX = useRef<number | null>(null);
  const [pageIndex, setPageIndex] = useState(() =>
    clamp(getStoredNumber(lastPageKey, 0), 0, pages.length - 1)
  );
  const [fontSize, setFontSize] = useState(() =>
    clamp(getStoredNumber(FONT_SIZE_KEY, DEFAULT_FONT_SIZE), MIN_FONT_SIZE, MAX_FONT_SIZE)
  );
  const [isSpeaking, setIsSpeaking] = useState(false);

  const currentPage = pages[pageIndex];
  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < pages.length - 1;
  const isTtsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  function stopSpeaking() {
    if (!isTtsSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function goToPage(nextIndex: number) {
    stopSpeaking();
    setPageIndex(clamp(nextIndex, 0, pages.length - 1));
  }

  function goPrev() {
    if (canGoPrev) goToPage(pageIndex - 1);
  }

  function goNext() {
    if (canGoNext) goToPage(pageIndex + 1);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.changedTouches[0].clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0].clientX;
    const diff = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(diff) < 50) return;

    if (diff > 0) {
      goPrev();
    } else {
      goNext();
    }
  }

  function handleSelectChapter(chapterNumber: number) {
    const chapterPageIndex = pages.findIndex(
      (page) => page.type === "body" && page.chapterNumber === chapterNumber
    );
    if (chapterPageIndex >= 0) goToPage(chapterPageIndex);
  }

  function decreaseFontSize() {
    setFontSize((size) => clamp(size - 2, MIN_FONT_SIZE, MAX_FONT_SIZE));
  }

  function increaseFontSize() {
    setFontSize((size) => clamp(size + 2, MIN_FONT_SIZE, MAX_FONT_SIZE));
  }

  function speakCurrentPage() {
    if (!isTtsSupported) return;

    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(getPageText(book, currentPage));
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    window.localStorage.setItem(lastPageKey, String(pageIndex));
  }, [lastPageKey, pageIndex]);

  useEffect(() => {
    window.localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    return () => {
      if (isTtsSupported) window.speechSynthesis.cancel();
    };
  }, [isTtsSupported]);

  return (
    <section className="readerScreen">
      <header className="readerTopBar">
        <button className="iconButton" onClick={onBack} aria-label="보관함으로 돌아가기">‹</button>
        <div className="readerTitle">
          <strong>{book.title}</strong>
          <span>{pageIndex + 1} / {pages.length}</span>
        </div>
      </header>

      <main
        className="readerStage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentPage.type === "cover" && <BookCover book={book} />}
        {currentPage.type === "toc" && (
          <TableOfContents book={book} onSelectChapter={handleSelectChapter} />
        )}
        {currentPage.type === "body" && (
          <BookPage page={currentPage} fontSize={fontSize} />
        )}
      </main>

      <footer className="readerBottomDock">
        <TTSControl
          isSpeaking={isSpeaking}
          isSupported={isTtsSupported}
          onSpeak={speakCurrentPage}
          onStop={stopSpeaking}
        />
        <PageNavigation
          currentPage={pageIndex + 1}
          totalPages={pages.length}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
        />
        <FontSizeControl
          fontSize={fontSize}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          onDecrease={decreaseFontSize}
          onIncrease={increaseFontSize}
        />
      </footer>
    </section>
  );
}

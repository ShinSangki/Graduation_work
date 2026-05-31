import { useMemo, useState } from "react";
import { BiographyEditorScreen, EditorData } from "./components/BiographyEditorScreen";
import { EpisodeDemoScreen } from "./components/EpisodeDemoScreen";
import { BiographyReaderScreen } from "./components/BiographyReaderScreen";
import { GenerateProgressScreen } from "./components/GenerateProgressScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LibraryScreen } from "./components/LibraryScreen";
import { PreRecordSetupScreen } from "./components/PreRecordSetupScreen";
import { RecordScreen } from "./components/RecordScreen";
import { BiographyBook, getFirstBodyText, mergeMemoirBooks, sampleBiography } from "./data/sampleBiography";
import { RecordedAudio } from "./hooks/useAudioRecorder";
import { MemoirSummary, useMemoirDB } from "./hooks/useMemoirDB";

type AppScreen = "home" | "setup" | "record" | "generate" | "library" | "reader" | "editor";

function toSummary(book: BiographyBook): MemoirSummary {
  return {
    id: book.id,
    title: book.title,
    createdAt: book.createdAt,
    preview: getFirstBodyText(book),
  };
}

export default function App() {
  return new URLSearchParams(window.location.search).get("demo") === "episode"
    ? <EpisodeDemoScreen />
    : <MemoryBookApp />;
}

export function MemoryBookApp() {
  const [screen, setScreen] = useState<AppScreen>("home");
  // CRUD는 AI 프록시 API가 아니라 기기 내부 SQLite만 사용한다.
  const { books: localBooks, isLoading, error, saveMemoir, getMemoirById, deleteMemoir } =
    useMemoirDB();
  const [activeBook, setActiveBook] = useState<BiographyBook | null>(null);
  const [previewBook, setPreviewBook] = useState<BiographyBook | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [recordContext, setRecordContext] = useState({ time: "", place: "" });
  const [editingSection, setEditingSection] = useState<{
    chapterNumber: number;
    sectionNumber: number;
  } | null>(null);

  const libraryBooks = useMemo(
    () => localBooks.length > 0 ? [localBooks[0]] : [toSummary(sampleBiography)],
    [localBooks]
  );
  const recentMemoir = localBooks[0] || null;

  async function openReader(bookId: string) {
    const book =
      bookId === sampleBiography.id
        ? sampleBiography
        : await getMemoirById(bookId);
    if (!book) return;
    setActiveBook(book);
    setScreen("reader");
  }

  async function deleteBook(bookId: string) {
    if (bookId === sampleBiography.id) {
      window.alert("샘플 자서전은 삭제할 수 없습니다.");
      return;
    }
    await deleteMemoir(bookId);
  }

  async function handleGenerated(book: BiographyBook) {
    const currentBook = localBooks[0] ? await getMemoirById(localBooks[0].id) : null;
    const nextBook = currentBook
      ? mergeMemoirBooks(currentBook, book)
      : mergeMemoirBooks({ ...sampleBiography, id: book.id }, book);
    const savedBook = await saveMemoir(nextBook, recordedAudio?.fileUri);
    setActiveBook(savedBook);
    setRecordedAudio(null);
    setScreen("reader");
  }

  async function saveEditor(updatedData: EditorData) {
    if (!activeBook || !editingSection) return;

    const updatedBook: BiographyBook = {
      ...activeBook,
      chapters: activeBook.chapters.map((chapter) =>
        chapter.chapterNumber !== editingSection.chapterNumber
          ? chapter
          : {
              ...chapter,
              title: updatedData.chapterTitle,
              sections: chapter.sections.map((section) =>
                section.sectionNumber !== editingSection.sectionNumber
                  ? section
                  : {
                      ...section,
                      title: updatedData.sectionTitle,
                      time: updatedData.time,
                      place: updatedData.place,
                      summary: updatedData.summary,
                      pages: [updatedData.body],
                    }
              ),
            }
      ),
    };

    setActiveBook(updatedBook);
    if (activeBook.id === sampleBiography.id) {
      window.alert("샘플 자서전 수정은 현재 화면에만 임시 적용됩니다.");
    } else {
      setActiveBook(await saveMemoir(updatedBook));
    }
    setEditingSection(null);
    setScreen("reader");
  }

  if (screen === "setup") {
    return (
      <PreRecordSetupScreen
        initialStep={setupStep}
        initialTime={recordContext.time}
        initialPlace={recordContext.place}
        onBack={() => setScreen("home")}
        onNext={(time, place) => {
          setRecordContext({ time, place });
          setSetupStep(2);
          setScreen("record");
        }}
      />
    );
  }

  if (screen === "record") {
    return (
      <RecordScreen
        time={recordContext.time}
        place={recordContext.place}
        onRecorded={(audio) => {
          setRecordedAudio(audio);
          setScreen("generate");
        }}
        onBack={() => {
          setSetupStep(2);
          setScreen("setup");
        }}
      />
    );
  }

  if (screen === "generate" && recordedAudio) {
    return (
      <GenerateProgressScreen
        audioBlob={recordedAudio.blob}
        audioUrl={recordedAudio.playbackUrl}
        time={recordContext.time}
        place={recordContext.place}
        onGenerated={handleGenerated}
        onBackHome={() => setScreen("home")}
      />
    );
  }

  if (screen === "library") {
    return (
      <LibraryScreen
        books={libraryBooks}
        previewBook={previewBook}
        isLoading={isLoading}
        error={error}
        onRead={openReader}
        onPreview={async (bookId) => {
          setPreviewBook(
            bookId === sampleBiography.id ? sampleBiography : await getMemoirById(bookId)
          );
        }}
        onDelete={deleteBook}
        onBackHome={() => setScreen("home")}
      />
    );
  }

  if (screen === "reader" && activeBook) {
    return (
      <BiographyReaderScreen
        book={activeBook}
        onBack={() => setScreen("library")}
        onEdit={(chapterNumber, sectionNumber) => {
          setEditingSection({ chapterNumber, sectionNumber });
          setScreen("editor");
        }}
      />
    );
  }

  if (screen === "editor" && activeBook && editingSection) {
    const chapter = activeBook.chapters.find(
      (item) => item.chapterNumber === editingSection.chapterNumber
    );
    const section = chapter?.sections.find(
      (item) => item.sectionNumber === editingSection.sectionNumber
    );

    if (chapter && section) {
      return (
        <BiographyEditorScreen
          initialData={{
            chapterTitle: chapter.title,
            sectionTitle: section.title,
            time: section.time,
            place: section.place,
            summary: section.summary,
            body: section.pages.join("\n\n"),
          }}
          audioUrl={activeBook.audioUrl}
          rawText={activeBook.rawText}
          onCancel={() => {
            setEditingSection(null);
            setScreen("reader");
          }}
          onSave={saveEditor}
        />
      );
    }
  }

  return (
    <HomeScreen
      recentMemoir={recentMemoir}
      onStartRecord={() => {
        setSetupStep(1);
        setScreen("setup");
      }}
      onOpenLibrary={() => setScreen("library")}
      onReadRecent={openReader}
    />
  );
}

import { useMemo, useState } from "react";
import { BiographyEditorScreen, EditorData } from "./components/BiographyEditorScreen";
import { BiographyReaderScreen } from "./components/BiographyReaderScreen";
import { GenerateProgressScreen } from "./components/GenerateProgressScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LibraryScreen } from "./components/LibraryScreen";
import { PreRecordSetupScreen } from "./components/PreRecordSetupScreen";
import { RecordScreen } from "./components/RecordScreen";
import { BiographyBook, mergeMemoirBooks } from "./data/sampleBiography";
import { RecordedAudio } from "./hooks/useAudioRecorder";
import { useMemoirDB } from "./hooks/useMemoirDB";

type AppScreen = "home" | "setup" | "record" | "generate" | "library" | "reader" | "editor";

function createEmptyMemoir(id: string): BiographyBook {
  return {
    id,
    title: "나의 기억책",
    createdAt: new Date().toISOString(),
    chapters: [],
  };
}

export default function App() {
  return <MemoryBookApp />;
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

  const libraryBooks = useMemo(() => localBooks, [localBooks]);
  const recentMemoir = localBooks[0] || null;

  async function openReader(bookId: string) {
    const book = await getMemoirById(bookId);
    if (!book) return;
    setActiveBook(book);
    setScreen("reader");
  }

  async function deleteBook(bookId: string) {
    await deleteMemoir(bookId);
  }

  async function handleGenerated(book: BiographyBook) {
    const currentBook = localBooks[0] ? await getMemoirById(localBooks[0].id) : null;
    const nextBook = currentBook
      ? mergeMemoirBooks(currentBook, book)
      : mergeMemoirBooks(createEmptyMemoir(book.id), book);
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
    setActiveBook(await saveMemoir(updatedBook));
    setEditingSection(null);
    setScreen("reader");
  }

  async function reorderChapters(chapters: BiographyBook["chapters"]) {
    if (!activeBook) return;
    const updatedBook = { ...activeBook, chapters };
    setActiveBook(updatedBook);
    setActiveBook(await saveMemoir(updatedBook));
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
          setPreviewBook(await getMemoirById(bookId));
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
        onReorderChapters={(chapters) => void reorderChapters(chapters)}
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

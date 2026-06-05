import { type ReactNode, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { BiographyEditorScreen, EditorData } from "./components/BiographyEditorScreen";
import { BiographyReaderScreen } from "./components/BiographyReaderScreen";
import { GenerateProgressScreen } from "./components/GenerateProgressScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LibraryScreen } from "./components/LibraryScreen";
import { PreRecordSetupScreen } from "./components/PreRecordSetupScreen";
import { RecordScreen } from "./components/RecordScreen";
import { StorageConsentScreen } from "./components/StorageConsentScreen";
import { demoMemoirs } from "./data/demoMemoirs";
import { BiographyBook } from "./data/sampleBiography";
import { RecordedAudio } from "./hooks/useAudioRecorder";
import { useMemoirDB } from "./hooks/useMemoirDB";
import { generateEpisodeFromText } from "./services/api";

type AppScreen = "home" | "setup" | "record" | "generate" | "library" | "reader" | "editor";
type ReaderBackScreen = "home" | "library";
type RecordFlow = "setup-first" | "record-first";
type TouchStart = { x: number; y: number; fromRightEdge: boolean };

const RIGHT_EDGE_WIDTH = 56;
const SWIPE_MIN_DISTANCE = 80;
const SWIPE_MAX_VERTICAL_DRIFT = 60;

export default function App() {
  return <MemoryBookApp />;
}

export function MemoryBookApp() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const screenRef = useRef<AppScreen>("home");
  const historyStackRef = useRef<AppScreen[]>([]);
  const forwardStackRef = useRef<AppScreen[]>([]);
  const touchStartRef = useRef<TouchStart | null>(null);
  // CRUD는 AI 프록시 API가 아니라 기기 내부 SQLite만 사용한다.
  const {
    books: localBooks,
    isLoading,
    error,
    storageReady,
    storageError,
    prepareStorage,
    saveMemoir,
    saveMemoirToBiographies,
    saveDemoMemoirs,
    createNewBiography,
    updateMemoirCover,
    getMemoirById,
    deleteMemoir,
    deleteMemoirChapter,
  } = useMemoirDB();
  const [activeBook, setActiveBook] = useState<BiographyBook | null>(null);
  const [previewBook, setPreviewBook] = useState<BiographyBook | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);
  const [readerBackScreen, setReaderBackScreen] = useState<ReaderBackScreen>("library");
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [recordContext, setRecordContext] = useState({ time: "", place: "" });
  const [recordFlow, setRecordFlow] = useState<RecordFlow>("setup-first");
  const [generationTargetIds, setGenerationTargetIds] = useState<string[]>([]);
  const [isDemoGenerating, setIsDemoGenerating] = useState(false);
  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<{
    chapterNumber: number;
    sectionNumber: number;
  } | null>(null);

  const libraryBooks = useMemo(() => localBooks, [localBooks]);
  const recentMemoir = localBooks[0] || null;

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const navigateTo = useCallback((nextScreen: AppScreen, options?: { replace?: boolean }) => {
    setScreen((currentScreen) => {
      if (currentScreen === nextScreen) return currentScreen;
      if (!options?.replace) historyStackRef.current.push(currentScreen);
      forwardStackRef.current = [];
      return nextScreen;
    });
  }, []);

  const goBack = useCallback((fallbackScreen: AppScreen = "home") => {
    setScreen((currentScreen) => {
      const previousScreen = historyStackRef.current.pop();
      if (previousScreen) {
        forwardStackRef.current.push(currentScreen);
        return previousScreen;
      }
      return currentScreen === fallbackScreen ? currentScreen : fallbackScreen;
    });
  }, []);

  const goForward = useCallback(() => {
    setScreen((currentScreen) => {
      const nextScreen = forwardStackRef.current.pop();
      if (!nextScreen) return currentScreen;
      historyStackRef.current.push(currentScreen);
      return nextScreen;
    });
  }, []);

  useEffect(() => {
    let backButtonListener: Awaited<ReturnType<typeof CapacitorApp.addListener>> | undefined;

    void CapacitorApp.addListener("backButton", () => {
      if (screenRef.current === "home" && historyStackRef.current.length === 0) {
        void CapacitorApp.exitApp();
        return;
      }
      goBack("home");
    }).then((listener) => {
      backButtonListener = listener;
    });

    return () => {
      void backButtonListener?.remove();
    };
  }, [goBack]);

  function handleRootTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      fromRightEdge: window.innerWidth - touch.clientX <= RIGHT_EDGE_WIDTH,
    };
  }

  function handleRootTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || screenRef.current === "reader") return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    const isRightEdgeForwardSwipe =
      start.fromRightEdge && deltaX <= -SWIPE_MIN_DISTANCE && deltaY <= SWIPE_MAX_VERTICAL_DRIFT;

    if (isRightEdgeForwardSwipe) {
      goForward();
    }
  }

  function renderWithNavigationGestures(content: ReactNode) {
    return (
      <div
        className="app-navigation-shell"
        onTouchStart={handleRootTouchStart}
        onTouchEnd={handleRootTouchEnd}
      >
        {content}
      </div>
    );
  }

  async function openReader(bookId: string, backScreen: ReaderBackScreen = "library") {
    const book = await getMemoirById(bookId);
    if (!book) return;
    setActiveBook(book);
    setReaderBackScreen(backScreen);
    navigateTo("reader");
  }

  async function deleteBook(bookId: string) {
    await deleteMemoir(bookId);
  }

  async function handleGenerated(
    book: BiographyBook,
    biographyIds: string[],
    nextScreen: "reader" | "library" = "reader"
  ) {
    const targetIds = biographyIds.length > 0
      ? biographyIds
      : localBooks[0]?.id
        ? [localBooks[0].id]
        : [];
    const savedBooks = await saveMemoirToBiographies(book, targetIds, recordedAudio?.fileUri);
    setActiveBook(savedBooks[0] || null);
    setReaderBackScreen("library");
    setRecordedAudio(null);
    setGenerationTargetIds([]);
    navigateTo(nextScreen);
  }

  function startNewRecord() {
    setRecordFlow("setup-first");
    setSetupStep(1);
    setGenerationTargetIds([]);
    navigateTo("setup");
  }

  function startRecordFirst() {
    setRecordFlow("record-first");
    setSetupStep(1);
    setRecordContext({ time: "", place: "" });
    setGenerationTargetIds([]);
    setRecordedAudio(null);
    navigateTo("record");
  }

  async function createDemoData() {
    if (isDemoGenerating) return;
    setIsDemoGenerating(true);
    setRecordContext({ time: "시연용 기억", place: "더미데이터" });
    setSetupStep(1);
    navigateTo("setup");
    window.setTimeout(() => {
      setSetupStep(2);
    }, 1000);
    window.setTimeout(() => {
      navigateTo("record");
    }, 2000);
    window.setTimeout(() => {
      setRecordedAudio({
        blob: new Blob(["demo"], { type: "audio/webm" }),
        fileUri: "demo://memory-book",
        playbackUrl: "",
      });
      navigateTo("generate");
    }, 4000);
  }

  async function finishDemoDataGeneration() {
    await saveDemoMemoirs(demoMemoirs);
    setIsDemoGenerating(false);
    setRecordedAudio(null);
    navigateTo("library");
  }

  async function updateActiveCover(coverImage: string) {
    if (!activeBook) return;
    const updatedBook = await updateMemoirCover(activeBook.id, coverImage);
    setActiveBook(updatedBook || { ...activeBook, coverImage });
  }

  async function createTextEpisodeForActiveBook() {
    if (!activeBook) return;
    const rawText = window.prompt("자서전에 추가할 이야기를 입력해 주세요.");
    if (!rawText?.trim()) return;

    const generated = await generateEpisodeFromText({
      sttRawText: rawText.trim(),
      time: recordContext.time,
      place: recordContext.place,
    });
    const now = new Date().toISOString();
    const generatedBook: BiographyBook = {
      id: `text-${Date.now()}`,
      title: activeBook.title,
      createdAt: now,
      recordedAt: now,
      rawText,
      chapters: [
        {
          chapterNumber: 1,
          title: generated.episode.title,
          sections: [
            {
              sectionNumber: 1,
              title: generated.episode.title,
              episodeId: generated.episode.episode_id,
              rawText,
              time: recordContext.time,
              place: recordContext.place,
              summary: generated.episode.tags.join(", "),
              pages: [generated.episode.content],
            },
          ],
        },
      ],
    };
    const [savedBook] = await saveMemoirToBiographies(generatedBook, [activeBook.id]);
    if (savedBook) setActiveBook(savedBook);
  }

  function handleReaderCreateEpisode(method: "record" | "upload" | "text") {
    if (!activeBook) return;
    if (method === "text") {
      void createTextEpisodeForActiveBook();
      return;
    }

    setGenerationTargetIds([activeBook.id]);
    setSetupStep(1);
    navigateTo("record");
  }

  async function saveEditor(updatedData: EditorData) {
    if (!activeBook || !editingSection || isEditorSaving) return;

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

    setIsEditorSaving(true);
    try {
      setActiveBook(updatedBook);
      setActiveBook(await saveMemoir(updatedBook));
      setEditingSection(null);
      navigateTo("reader", { replace: true });
    } finally {
      setIsEditorSaving(false);
    }
  }

  async function reorderChapters(chapters: BiographyBook["chapters"]) {
    if (!activeBook) return;
    const updatedBook = { ...activeBook, chapters };
    setActiveBook(updatedBook);
    setActiveBook(await saveMemoir(updatedBook));
  }

  async function deleteChapter(chapterNumber: number) {
    if (!activeBook) return;
    const updatedBook = await deleteMemoirChapter(activeBook.id, chapterNumber);
    if (updatedBook) setActiveBook(updatedBook);
  }

  if (!storageReady) {
    return renderWithNavigationGestures(
      <StorageConsentScreen
        error={storageError}
        isLoading={isLoading}
        onAgree={() => void prepareStorage()}
      />
    );
  }

  if (screen === "setup") {
    return renderWithNavigationGestures(
      <PreRecordSetupScreen
        initialStep={setupStep}
        initialTime={recordContext.time}
        initialPlace={recordContext.place}
        onBack={() => goBack("home")}
        finalButtonLabel={recordFlow === "record-first" ? "자서전 생성" : "녹음 화면으로"}
        onNext={(time, place) => {
          if (isDemoGenerating) return;
          setRecordContext({ time, place });
          setSetupStep(2);
          navigateTo(recordFlow === "record-first" ? "generate" : "record");
        }}
      />
    );
  }

  if (screen === "record") {
    return renderWithNavigationGestures(
      <RecordScreen
        time={recordContext.time}
        place={recordContext.place}
        onRecorded={(audio) => {
          if (isDemoGenerating) return;
          setRecordedAudio(audio);
          if (recordFlow === "record-first") {
            setSetupStep(1);
            navigateTo("setup");
            return;
          }
          navigateTo("generate");
        }}
        onBack={() => {
          if (recordFlow === "record-first") {
            goBack("home");
            return;
          }
          setSetupStep(2);
          goBack("setup");
        }}
        autoStart={false}
        generateButtonLabel={recordFlow === "record-first" ? "시기 선택" : "자서전 생성"}
      />
    );
  }

  if (screen === "generate" && recordedAudio) {
    return renderWithNavigationGestures(
      <GenerateProgressScreen
        audioBlob={recordedAudio.blob}
        audioUrl={recordedAudio.playbackUrl}
        time={recordContext.time}
        place={recordContext.place}
        biographies={libraryBooks}
        initialSelectedBiographyIds={generationTargetIds}
        onGenerated={handleGenerated}
        isDemoMode={isDemoGenerating}
        demoBooks={demoMemoirs}
        onGenerateDemoBooks={() => finishDemoDataGeneration()}
        onBackHome={() => navigateTo("home")}
      />
    );
  }

  if (screen === "library") {
    return renderWithNavigationGestures(
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
        onBackHome={() => goBack("home")}
        onStartRecord={startNewRecord}
        onCreateBiography={createNewBiography}
      />
    );
  }

  if (screen === "reader" && activeBook) {
    return renderWithNavigationGestures(
      <BiographyReaderScreen
        book={activeBook}
        onBack={() => goBack(readerBackScreen)}
        onEdit={(chapterNumber, sectionNumber) => {
          setEditingSection({ chapterNumber, sectionNumber });
          navigateTo("editor");
        }}
        onReorderChapters={(chapters) => void reorderChapters(chapters)}
        onDeleteChapter={(chapterNumber) => void deleteChapter(chapterNumber)}
        onUpdateCover={updateActiveCover}
        onCreateEpisode={handleReaderCreateEpisode}
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
      return renderWithNavigationGestures(
        <BiographyEditorScreen
          initialData={{
            chapterTitle: chapter.title,
            sectionTitle: section.title,
            time: section.time,
            place: section.place,
            summary: section.summary,
            body: section.pages.join("\n\n"),
          }}
          audioUrl={section.audioUrl}
          rawText={section.rawText}
          isSaving={isEditorSaving}
          onCancel={() => {
            setEditingSection(null);
            goBack("reader");
          }}
          onSave={saveEditor}
        />
      );
    }
  }

  return renderWithNavigationGestures(
    <HomeScreen
      recentMemoir={recentMemoir}
      onStartRecord={() => {
        startNewRecord();
      }}
      onStartRecordFirst={startRecordFirst}
      onOpenLibrary={() => navigateTo("library")}
      onReadRecent={(bookId) => void openReader(bookId, "home")}
      onCreateDemoData={() => void createDemoData()}
    />
  );
}

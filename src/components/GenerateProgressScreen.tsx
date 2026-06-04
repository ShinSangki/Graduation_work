import { useEffect, useState } from "react";
import { BiographyPreview } from "./BiographyPreview";
import { BiographyBook } from "../data/sampleBiography";
import { MemoirSummary } from "../hooks/useMemoirDB";
import { generateMemoir } from "../services/api";

type GenerateProgressScreenProps = {
  audioBlob: Blob;
  audioUrl?: string;
  time: string;
  place: string;
  biographies: MemoirSummary[];
  initialSelectedBiographyIds?: string[];
  onGenerated: (
    book: BiographyBook,
    biographyIds: string[],
    nextScreen?: "reader" | "library"
  ) => Promise<void>;
  onBackHome: () => void;
};

const steps = ["STT 변환 중", "자서전 생성 중", "완료"];

export function GenerateProgressScreen({
  audioBlob,
  audioUrl,
  time,
  place,
  biographies,
  initialSelectedBiographyIds = [],
  onGenerated,
  onBackHome,
}: GenerateProgressScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [book, setBook] = useState<BiographyBook | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBiographyIds, setSelectedBiographyIds] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const isDone = currentStep === steps.length - 1;

  useEffect(() => {
    setSelectedBiographyIds((current) => {
      const preferredIds = initialSelectedBiographyIds.filter((id) =>
        biographies.some((book) => book.id === id)
      );
      if (preferredIds.length > 0) return preferredIds;
      const validIds = current.filter((id) => biographies.some((book) => book.id === id));
      if (validIds.length > 0) return validIds;
      return biographies[0]?.id ? [biographies[0].id] : [];
    });
  }, [biographies, initialSelectedBiographyIds]);

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        setError("");
        setBook(null);
        setShowPreview(false);
        setCurrentStep(0);
        setCurrentStep(1);
        const detail = await generateMemoir(audioBlob, time, place, audioUrl);
        if (ignore) return;

        setBook(detail);
        setCurrentStep(2);
      } catch (generateError) {
        if (!ignore) {
          setError(generateError instanceof Error ? generateError.message : "자서전 생성에 실패했습니다.");
        }
      }
    }

    run();

    return () => {
      ignore = true;
    };
  }, [audioBlob, audioUrl, place, retryCount, time]);

  async function handleRead() {
    if (!book || isSaving) return;
    try {
      setError("");
      setIsSaving(true);
      await onGenerated(book, selectedBiographyIds);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "자서전을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenLibrary() {
    if (!book || isSaving) return;
    try {
      setError("");
      setIsSaving(true);
      await onGenerated(book, selectedBiographyIds, "library");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "자서전을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleBackHome() {
    if (!isDone && !error && !window.confirm("생성을 중단하고 처음으로 돌아갈까요?")) {
      return;
    }
    onBackHome();
  }

  function toggleBiography(biographyId: string) {
    setSelectedBiographyIds((current) =>
      current.includes(biographyId)
        ? current.filter((id) => id !== biographyId)
        : [...current, biographyId]
    );
  }

  return (
    <main className="screen">
      <section className="topAppBar">
        <button className="iconButton" onClick={handleBackHome} aria-label="처음으로">‹</button>
        <strong>자서전 생성</strong>
      </section>
      <section className="simplePanel">
        <p className="eyebrow">생성 진행</p>
        <h1>{isDone ? "자서전이 준비됐어요" : "기억을 책으로 정리 중"}</h1>
        <ol className="progressList">
          {steps.map((step, index) => (
            <li className={index <= currentStep ? "active" : ""} key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        {error && (
          <>
            <p className="errorText">{error}</p>
            <div className="buttonStack">
              <button className="primaryButton" onClick={() => setRetryCount((count) => count + 1)}>
                다시 시도
              </button>
              <button className="secondaryButton" onClick={onBackHome}>
                처음으로
              </button>
            </div>
          </>
        )}
        {isDone && (
          <>
            <fieldset className="selectionPanel">
              <legend>저장할 자서전 선택</legend>
              <p className="mutedText">선택한 자서전에 이번 이야기가 각각 저장됩니다.</p>
              {biographies.map((biography) => (
                <label className="checkRow" key={biography.id}>
                  <input
                    type="checkbox"
                    checked={selectedBiographyIds.includes(biography.id)}
                    onChange={() => toggleBiography(biography.id)}
                  />
                  <span>{biography.title}</span>
                </label>
              ))}
              {biographies.length === 0 && (
                <p className="errorText">저장할 자서전이 없습니다. 보관함에서 먼저 만들어 주세요.</p>
              )}
            </fieldset>
            <div className="buttonStack">
              <button className="secondaryButton" onClick={() => setShowPreview((value) => !value)}>
                미리보기
              </button>
              <button
                className="secondaryButton"
                onClick={handleOpenLibrary}
                disabled={!book || isSaving || selectedBiographyIds.length === 0}
              >
                {isSaving ? "저장 중" : "저장 후 보관함"}
              </button>
              <button
                className="primaryButton"
                onClick={handleRead}
                disabled={!book || isSaving || selectedBiographyIds.length === 0}
              >
                {isSaving ? "저장 중" : "저장 후 읽기"}
              </button>
            </div>
          </>
        )}
      </section>
      {isDone && showPreview && book && <BiographyPreview book={book} onRead={handleRead} />}
    </main>
  );
}

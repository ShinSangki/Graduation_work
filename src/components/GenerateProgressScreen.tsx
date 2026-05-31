import { useEffect, useState } from "react";
import { BiographyPreview } from "./BiographyPreview";
import { BiographyBook } from "../data/sampleBiography";
import { generateMemoir } from "../services/api";

type GenerateProgressScreenProps = {
  audioBlob: Blob;
  audioUrl?: string;
  time: string;
  place: string;
  onGenerated: (book: BiographyBook) => void;
  onBackHome: () => void;
};

const steps = ["STT 변환 중", "자서전 생성 중", "완료"];

export function GenerateProgressScreen({
  audioBlob,
  audioUrl,
  time,
  place,
  onGenerated,
  onBackHome,
}: GenerateProgressScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [book, setBook] = useState<BiographyBook | null>(null);
  const [error, setError] = useState("");
  const isDone = currentStep === steps.length - 1;

  useEffect(() => {
    let ignore = false;

    async function run() {
      try {
        setError("");
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
  }, [audioBlob, audioUrl, place, time]);

  function handleRead() {
    if (book) onGenerated(book);
  }

  return (
    <main className="screen">
      <section className="topAppBar">
        <button className="iconButton" onClick={onBackHome} aria-label="처음으로">‹</button>
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
        {error && <p className="errorText">{error}</p>}
        {isDone && (
          <div className="buttonStack">
            <button className="secondaryButton" onClick={() => setShowPreview((value) => !value)}>
              미리보기
            </button>
            <button className="primaryButton" onClick={handleRead} disabled={!book}>전체 읽기</button>
          </div>
        )}
      </section>
      {isDone && showPreview && book && <BiographyPreview book={book} onRead={handleRead} />}
    </main>
  );
}

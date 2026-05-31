import { useEffect, useState } from "react";

type SetupStep = 1 | 2;

type PreRecordSetupScreenProps = {
  initialStep: SetupStep;
  initialTime?: string;
  initialPlace?: string;
  onNext: (time: string, place: string) => void;
  onBack: () => void;
};

const timeOptions = ["어린 시절", "학창 시절", "청춘 시절", "가족과 함께한 시간", "최근의 기억"];
const placeOptions = ["고향/동네", "학교/학원", "직장", "우리 집", "기타 장소"];

export function PreRecordSetupScreen({
  initialStep,
  initialTime = "",
  initialPlace = "",
  onNext,
  onBack,
}: PreRecordSetupScreenProps) {
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [time, setTime] = useState(initialTime);
  const [place, setPlace] = useState(initialPlace);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  function handleBack() {
    if (step === 2) {
      setStep(1);
      return;
    }
    onBack();
  }

  function handleContinue() {
    if (step === 1 && time) {
      setStep(2);
      return;
    }
    if (step === 2 && place) onNext(time, place);
  }

  const options = step === 1 ? timeOptions : placeOptions;
  const selectedValue = step === 1 ? time : place;

  return (
    <main className="screen">
      <section className="topAppBar">
        <button className="iconButton" onClick={handleBack} aria-label="뒤로가기">
          ‹
        </button>
        <strong>녹음 준비 {step} / 2</strong>
      </section>

      <section className="simplePanel" style={{ marginTop: "24px" }}>
        <p className="eyebrow">이야기 주제 선택</p>
        <h1 style={{ lineHeight: 1.45 }}>
          {step === 1 ? "어느 시기의 기억인가요?" : "어느 장소의 기억인가요?"}
        </h1>
        <p className="leadText" style={{ fontSize: "1.1rem" }}>
          가장 가까운 항목을 하나 골라주세요.
        </p>

        <div style={{ display: "grid", gap: "12px", marginTop: "24px" }}>
          {options.map((option) => {
            const isSelected = option === selectedValue;
            return (
              <button
                className={isSelected ? "primaryButton" : "secondaryButton"}
                key={option}
                onClick={() => (step === 1 ? setTime(option) : setPlace(option))}
                style={{ fontSize: "1.15rem", minHeight: "60px", textAlign: "left" }}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ marginTop: "20px" }}>
        <button
          className="primaryButton"
          disabled={!selectedValue}
          onClick={handleContinue}
          style={{ fontSize: "1.2rem", minHeight: "60px", width: "100%" }}
          type="button"
        >
          {step === 1 ? "다음" : "녹음 화면으로"}
        </button>
      </div>
    </main>
  );
}

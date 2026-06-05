import { useEffect, useState } from "react";

type SetupStep = 1 | 2;

type PreRecordSetupScreenProps = {
  initialStep: SetupStep;
  initialTime?: string;
  initialPlace?: string;
  onNext: (time: string, place: string) => void;
  onBack: () => void;
  finalButtonLabel?: string;
};

const OTHER_OPTION = "기타";
const timeOptions = ["어린 시절", "학창 시절", "청춘 시절", "가족과 함께한 시간", "최근의 기억", OTHER_OPTION];
const placeOptions = ["고향/동네", "학교/학원", "직장", "우리 집", OTHER_OPTION];

function getInitialOption(value: string, options: string[]) {
  if (!value) return "";
  return options.includes(value) ? value : OTHER_OPTION;
}

function getInitialCustomValue(value: string, options: string[]) {
  return value && !options.includes(value) ? value : "";
}

export function PreRecordSetupScreen({
  initialStep,
  initialTime = "",
  initialPlace = "",
  onNext,
  onBack,
  finalButtonLabel = "녹음 화면으로",
}: PreRecordSetupScreenProps) {
  const [step, setStep] = useState<SetupStep>(initialStep);
  const [time, setTime] = useState(() => getInitialOption(initialTime, timeOptions));
  const [place, setPlace] = useState(() => getInitialOption(initialPlace, placeOptions));
  const [customTime, setCustomTime] = useState(() => getInitialCustomValue(initialTime, timeOptions));
  const [customPlace, setCustomPlace] = useState(() => getInitialCustomValue(initialPlace, placeOptions));

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
    const resolvedTime = time === OTHER_OPTION ? customTime.trim() : time;
    const resolvedPlace = place === OTHER_OPTION ? customPlace.trim() : place;

    if (step === 1 && resolvedTime) {
      setStep(2);
      return;
    }
    if (step === 2 && resolvedPlace) onNext(resolvedTime, resolvedPlace);
  }

  const options = step === 1 ? timeOptions : placeOptions;
  const selectedValue = step === 1 ? time : place;
  const customValue = step === 1 ? customTime : customPlace;
  const canContinue = selectedValue === OTHER_OPTION ? Boolean(customValue.trim()) : Boolean(selectedValue);

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

        {selectedValue === OTHER_OPTION && (
          <input
            aria-label={step === 1 ? "시기 직접 입력" : "장소 직접 입력"}
            autoFocus
            onChange={(event) => (
              step === 1 ? setCustomTime(event.target.value) : setCustomPlace(event.target.value)
            )}
            placeholder={step === 1 ? "예: 첫 직장을 다니던 시절" : "예: 창원 아파트"}
            style={{
              border: "1px solid rgba(23, 25, 31, 0.16)",
              borderRadius: "14px",
              fontSize: "1.1rem",
              marginTop: "16px",
              minHeight: "58px",
              padding: "12px 14px",
              width: "100%",
            }}
            value={customValue}
          />
        )}
      </section>

      <div style={{ marginTop: "20px" }}>
        <button
          className="primaryButton"
          disabled={!canContinue}
          onClick={handleContinue}
          style={{ fontSize: "1.2rem", minHeight: "60px", width: "100%" }}
          type="button"
        >
          {step === 1 ? "다음" : finalButtonLabel}
        </button>
      </div>
    </main>
  );
}

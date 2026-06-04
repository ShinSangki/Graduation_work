type StorageConsentScreenProps = {
  error: string;
  isLoading: boolean;
  onAgree: () => void;
};

export function StorageConsentScreen({
  error,
  isLoading,
  onAgree,
}: StorageConsentScreenProps) {
  return (
    <main className="screen">
      <section className="simplePanel">
        <p className="eyebrow">저장공간 안내</p>
        <h1>기억책을 기기에 저장할게요</h1>
        <p className="mutedText">
          녹음 파일과 자서전은 이 앱의 내부 저장공간에 보관됩니다.
          보관함과 이어서 읽기를 사용하려면 저장에 동의해주세요.
        </p>
        {error && <p className="errorText">{error}</p>}
        <button
          className="primaryButton"
          disabled={isLoading}
          onClick={onAgree}
          type="button"
        >
          {isLoading ? "저장공간 준비 중" : "동의하고 시작하기"}
        </button>
      </section>
    </main>
  );
}

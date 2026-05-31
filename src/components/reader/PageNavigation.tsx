type PageNavigationProps = {
  currentPage: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function PageNavigation({
  currentPage,
  totalPages,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: PageNavigationProps) {
  return (
    <nav className="pageNavigation" aria-label="페이지 이동">
      <button onClick={onPrev} disabled={!canGoPrev}>
        이전
      </button>
      <span>{currentPage} / {totalPages}</span>
      <button onClick={onNext} disabled={!canGoNext}>
        다음
      </button>
    </nav>
  );
}

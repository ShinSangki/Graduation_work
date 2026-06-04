import { useState } from "react";
import { BiographyPreview } from "./BiographyPreview";
import { BiographyBook, formatKoreanDate } from "../data/sampleBiography";
import { MemoirSummary } from "../hooks/useMemoirDB";

type LibraryScreenProps = {
  books: MemoirSummary[];
  previewBook: BiographyBook | null;
  isLoading: boolean;
  error: string;
  onRead: (bookId: string) => void;
  onPreview: (bookId: string) => void;
  onDelete: (bookId: string) => void;
  onBackHome: () => void;
  onStartRecord: () => void;
  onCreateBiography: (title: string) => Promise<BiographyBook>;
};

export function LibraryScreen({
  books,
  previewBook,
  isLoading,
  error,
  onRead,
  onPreview,
  onDelete,
  onBackHome,
  onStartRecord,
  onCreateBiography,
}: LibraryScreenProps) {
  const [previewBookId, setPreviewBookId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const canCreateBiography = books.length < 3;

  function handleDelete(book: MemoirSummary) {
    if (!window.confirm(`"${book.title}" 자서전을 삭제할까요?`)) return;
    onDelete(book.id);
  }

  async function handleCreateBiography() {
    if (!canCreateBiography) {
      setCreateError("자서전은 최대 3개까지 만들 수 있습니다.");
      return;
    }

    const title = window.prompt("새 자서전 제목을 입력해 주세요.", "새로운 자서전");
    if (!title) return;

    try {
      setCreateError("");
      await onCreateBiography(title);
    } catch (createFailure) {
      setCreateError(
        createFailure instanceof Error ? createFailure.message : "새 자서전을 만들지 못했습니다."
      );
    }
  }

  return (
    <main className="screen">
      <section className="topAppBar">
        <button className="iconButton" onClick={onBackHome} aria-label="처음으로">‹</button>
        <strong>보관함</strong>
      </section>
      <section className="libraryHeader">
        <p className="eyebrow">내 자서전</p>
        <h1>이어서 읽기</h1>
        <button
          className="secondaryButton"
          onClick={handleCreateBiography}
          disabled={!canCreateBiography}
          type="button"
        >
          + 새로운 자서전 만들기
        </button>
        <p className="mutedText">최대 3개까지 만들 수 있습니다. 현재 {books.length}개</p>
      </section>
      {error && <p className="errorText">{error}</p>}
      {createError && <p className="errorText">{createError}</p>}
      <div className="libraryList">
        {isLoading && (
          <section className="emptyState">
            <h2>보관함을 불러오는 중입니다</h2>
            <p className="mutedText">잠시만 기다려주세요.</p>
          </section>
        )}
        {!isLoading && books.length === 0 && (
          <section className="emptyState">
            <h2>보관된 자서전이 없습니다</h2>
            <p className="mutedText">녹음 후 자서전을 생성하면 이곳에 저장됩니다.</p>
            <button className="primaryButton" onClick={onStartRecord} type="button">
              녹음 시작
            </button>
          </section>
        )}
        {books.map((book) => {
          const isPreviewOpen = previewBookId === book.id;
          return (
            <section className="libraryCard" key={book.id}>
              <div
                className="bookThumb"
                aria-hidden="true"
                style={{
                  backgroundImage: book.coverImage ? `url("${book.coverImage}")` : undefined,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                {!book.coverImage && "책"}
              </div>
              <div>
                <h2>{book.title}</h2>
                <p className="mutedText">{formatKoreanDate(book.createdAt)} 생성</p>
                <p className="previewText">{(book.preview || "").replace(/\s+/g, " ").slice(0, 72)}...</p>
              </div>
              <div className="cardActions">
                <button
                  className="secondaryButton"
                  onClick={() => {
                    setPreviewBookId(isPreviewOpen ? null : book.id);
                    if (!isPreviewOpen) onPreview(book.id);
                  }}
                >
                  미리보기
                </button>
                <button className="primaryButton" onClick={() => onRead(book.id)}>이어서 읽기</button>
                <button className="dangerButton" onClick={() => handleDelete(book)}>삭제</button>
              </div>
              {isPreviewOpen && previewBook?.id === book.id && (
                <BiographyPreview book={previewBook} onRead={() => onRead(book.id)} />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

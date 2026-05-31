import {
  BiographyBook,
  formatKoreanDate,
  getFirstBodyText,
} from "../data/sampleBiography";

type BiographyPreviewProps = {
  book: BiographyBook;
  onRead: () => void;
};

export function BiographyPreview({ book, onRead }: BiographyPreviewProps) {
  const previewText = getFirstBodyText(book).replace(/\s+/g, " ").slice(0, 92);
  const tocPreview = book.chapters.slice(0, 3);

  return (
    <section className="previewPanel">
      <div>
        <p className="eyebrow">미리보기</p>
        <h2>{book.title}</h2>
        <p className="mutedText">{formatKoreanDate(book.createdAt)} 생성</p>
      </div>
      <p className="previewText">{previewText}...</p>
      <div>
        <h3>목차</h3>
        <ul className="previewToc">
          {tocPreview.map((chapter) => (
            <li key={chapter.chapterNumber}>
              제{chapter.chapterNumber}장 {chapter.title}
            </li>
          ))}
        </ul>
      </div>
      <button className="primaryButton" onClick={onRead}>전체 읽기</button>
    </section>
  );
}

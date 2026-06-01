/*
 * 임시 비활성: 이전 분리형 리더 전용 컴포넌트다.
 *
import { BiographyBook } from "../../data/sampleBiography";

type TableOfContentsProps = {
  book: BiographyBook;
  onSelectChapter: (chapterNumber: number) => void;
};

export function TableOfContents({ book, onSelectChapter }: TableOfContentsProps) {
  return (
    <article className="bookPage tocPage">
      <h2>목차</h2>
      <div className="tocList">
        {book.chapters.map((chapter) => (
          <button
            className="tocItem"
            key={chapter.chapterNumber}
            onClick={() => onSelectChapter(chapter.chapterNumber)}
          >
            <span>제{chapter.chapterNumber}장</span>
            <strong>{chapter.title}</strong>
          </button>
        ))}
      </div>
    </article>
  );
}
*/

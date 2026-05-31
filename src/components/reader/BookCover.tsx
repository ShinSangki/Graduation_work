import { BiographyBook, formatKoreanDate } from "../../data/sampleBiography";

type BookCoverProps = {
  book: BiographyBook;
};

export function BookCover({ book }: BookCoverProps) {
  return (
    <article className="bookPage coverPage">
      <p className="coverLabel">Autobiography</p>
      <h1>{book.title}</h1>
      {book.subtitle && <p className="coverSubtitle">{book.subtitle}</p>}
      <p className="coverDate">{formatKoreanDate(book.createdAt)} 생성</p>
    </article>
  );
}

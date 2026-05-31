import { ReaderPage } from "../../data/sampleBiography";

type BookPageProps = {
  page: Extract<ReaderPage, { type: "body" }>;
  fontSize: number;
};

export function BookPage({ page, fontSize }: BookPageProps) {
  return (
    <article className="bookPage bodyPage">
      <header className="bodyHeader">
        <p>제{page.chapterNumber}장 {page.chapterTitle}</p>
        <h2>{page.sectionNumber}절 {page.sectionTitle}</h2>
      </header>
      <div className="bodyText" style={{ fontSize }}>
        {page.body}
      </div>
    </article>
  );
}

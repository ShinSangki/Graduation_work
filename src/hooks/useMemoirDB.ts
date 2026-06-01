import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { BiographyBook, getFirstBodyText } from "../data/sampleBiography";
import { isNativeDatabaseAvailable, query, run, transaction } from "../db/database";

const STORAGE_KEY = "memory_book_local_memoirs";

export type MemoirSummary = {
  id: string;
  title: string;
  createdAt: string;
  preview?: string;
};

type MemoirRow = {
  id: number;
  title: string;
  createdAt: string;
  recordedAt?: string;
  filePath?: string;
  rawText?: string;
};

type ChapterRow = {
  id: number;
  chapterNumber: number;
  title: string;
};

type SectionRow = {
  sectionNumber: number;
  title: string;
  episodeId?: string;
  recordingId?: number;
  filePath?: string;
  rawText?: string;
  time?: string;
  place?: string;
  summary?: string;
  content: string;
};

function readFallbackBooks(): BiographyBook[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeFallbackBooks(books: BiographyBook[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function toSummary(book: BiographyBook): MemoirSummary {
  return {
    id: book.id,
    title: book.title,
    createdAt: book.createdAt,
    preview: getFirstBodyText(book),
  };
}

function fileNameFromUri(uri: string) {
  return decodeURIComponent(uri.split("/").pop() || `recording-${Date.now()}.webm`);
}

function mimeTypeFromUri(uri: string) {
  return uri.toLowerCase().endsWith(".m4a") ? "audio/mp4" : "audio/webm";
}

export function useMemoirDB() {
  const [books, setBooks] = useState<MemoirSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const getMemoirs = useCallback(async (): Promise<MemoirSummary[]> => {
    if (!isNativeDatabaseAvailable()) {
      return readFallbackBooks().map(toSummary);
    }

    const rows = await query<MemoirSummary>(`
      SELECT
        CAST(m.id AS TEXT) AS id,
        m.title,
        m.created_at AS createdAt,
        COALESCE(SUBSTR(s.content, 1, 160), '') AS preview
      FROM memoirs m
      LEFT JOIN memoir_chapters c ON c.memoir_id = m.id AND c.chapter_order = 1
      LEFT JOIN memoir_sections s ON s.chapter_id = c.id AND s.section_order = 1
      ORDER BY m.updated_at DESC, m.id DESC
    `);
    return rows;
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setBooks(await getMemoirs());
      setError("");
    } catch {
      setError("보관함을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [getMemoirs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getMemoirById = useCallback(async (id: string): Promise<BiographyBook | null> => {
    if (!isNativeDatabaseAvailable()) {
      return readFallbackBooks().find((book) => book.id === id) || null;
    }

    const memoir = (
      await query<MemoirRow>(
        `SELECT m.id, m.title, m.created_at AS createdAt, m.recorded_at AS recordedAt,
                r.file_path AS filePath, r.raw_text AS rawText
         FROM memoirs m
         LEFT JOIN recordings r ON r.id = m.recording_id
         WHERE m.id = ?`,
        [Number(id)]
      )
    )[0];
    if (!memoir) return null;

    const chapters = await query<ChapterRow>(
      `SELECT id, chapter_order AS chapterNumber, chapter_title AS title
       FROM memoir_chapters WHERE memoir_id = ? ORDER BY chapter_order`,
      [memoir.id]
    );

    return {
      id: String(memoir.id),
      title: memoir.title,
      createdAt: memoir.createdAt,
      recordedAt: memoir.recordedAt,
      audioUrl: memoir.filePath ? Capacitor.convertFileSrc(memoir.filePath) : undefined,
      rawText: memoir.rawText,
      chapters: await Promise.all(
        chapters.map(async (chapter) => ({
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          sections: (
            await query<SectionRow>(
              `SELECT s.section_order AS sectionNumber, s.section_title AS title,
                      s.episode_id AS episodeId, s.recording_id AS recordingId,
                      r.file_path AS filePath, s.raw_text AS rawText,
                      s.time, s.place, s.summary, s.content
               FROM memoir_sections s
               LEFT JOIN recordings r ON r.id = s.recording_id
               WHERE s.chapter_id = ? ORDER BY s.section_order`,
              [chapter.id]
            )
          ).map((section) => ({
            sectionNumber: section.sectionNumber,
            title: section.title,
            episodeId: section.episodeId,
            recordingId: section.recordingId,
            audioUrl: section.filePath
              ? Capacitor.convertFileSrc(section.filePath)
              : memoir.filePath
                ? Capacitor.convertFileSrc(memoir.filePath)
                : undefined,
            rawText: section.rawText,
            time: section.time,
            place: section.place,
            summary: section.summary,
            pages: [section.content],
          })),
        }))
      ),
    };
  }, []);

  const saveMemoir = useCallback(
    async (book: BiographyBook, audioFileUri?: string): Promise<BiographyBook> => {
      if (!isNativeDatabaseAvailable()) {
        writeFallbackBooks([book]);
        await refresh();
        return book;
      }

      const now = new Date().toISOString();
      const numericId = /^\d+$/.test(book.id) ? Number(book.id) : null;
      const memoirId = await transaction(async () => {
        let targetMemoirId = numericId;
        let latestRecordingId: number | null = null;

        if (audioFileUri) {
          const latestSection = book.chapters
            .flatMap((chapter) => chapter.sections)
            .find((section) => section.rawText === book.rawText);
          const recording = await run(
            `INSERT INTO recordings
             (file_name, file_path, mime_type, file_size, raw_text, time, place, created_at)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
            [
              fileNameFromUri(audioFileUri),
              audioFileUri,
              mimeTypeFromUri(audioFileUri),
              book.rawText || null,
              latestSection?.time || null,
              latestSection?.place || null,
              now,
            ]
          );
          latestRecordingId = recording.changes?.lastId || null;
          if (!latestRecordingId) throw new Error("녹음 저장에 실패했습니다.");
        }

        if (targetMemoirId) {
          await run(
            `UPDATE memoirs
             SET title = ?, updated_at = ?, recorded_at = ?,
                 recording_id = COALESCE(?, recording_id)
             WHERE id = ?`,
            [book.title, now, book.recordedAt || now, latestRecordingId, targetMemoirId]
          );
          await run("DELETE FROM memoir_chapters WHERE memoir_id = ?", [targetMemoirId]);
        } else {
          if (!latestRecordingId) throw new Error("신규 자서전에는 녹음 파일이 필요합니다.");

          const memoir = await run(
            `INSERT INTO memoirs
             (recording_id, title, created_at, updated_at, recorded_at)
             VALUES (?, ?, ?, ?, ?)`,
            [latestRecordingId, book.title, book.createdAt || now, now, book.recordedAt || now]
          );
          targetMemoirId = memoir.changes?.lastId || null;
        }

        if (!targetMemoirId) throw new Error("자서전 저장에 실패했습니다.");

        for (const chapter of book.chapters) {
          const insertedChapter = await run(
            `INSERT INTO memoir_chapters (memoir_id, chapter_order, chapter_title)
             VALUES (?, ?, ?)`,
            [targetMemoirId, chapter.chapterNumber, chapter.title]
          );
          const chapterId = insertedChapter.changes?.lastId;
          if (!chapterId) throw new Error("챕터 저장에 실패했습니다.");

          for (const section of chapter.sections) {
            await run(
              `INSERT INTO memoir_sections
               (chapter_id, section_order, section_title, episode_id, recording_id, raw_text, time, place, summary, content)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                chapterId,
                section.sectionNumber,
                section.title,
                section.episodeId || null,
                section.recordingId || (
                  latestRecordingId && section.rawText === book.rawText ? latestRecordingId : null
                ),
                section.rawText || null,
                section.time || null,
                section.place || null,
                section.summary || null,
                section.pages.join("\n\n"),
              ]
            );
          }
        }
        return targetMemoirId;
      });

      const saved = {
        ...book,
        id: String(memoirId),
        audioUrl: book.audioUrl || (audioFileUri ? Capacitor.convertFileSrc(audioFileUri) : undefined),
      };
      await refresh();
      return (await getMemoirById(String(memoirId))) || saved;
    },
    [getMemoirById, refresh]
  );

  const deleteMemoir = useCallback(
    async (id: string) => {
      if (!isNativeDatabaseAvailable()) {
        writeFallbackBooks(readFallbackBooks().filter((book) => book.id !== id));
      } else {
        await transaction(async () => {
          const rows = await query<{ recordingId: number }>(
            `SELECT recording_id AS recordingId FROM memoirs WHERE id = ?
             UNION
             SELECT s.recording_id AS recordingId
             FROM memoir_sections s
             JOIN memoir_chapters c ON c.id = s.chapter_id
             WHERE c.memoir_id = ? AND s.recording_id IS NOT NULL`,
            [Number(id), Number(id)]
          );
          await run("DELETE FROM memoirs WHERE id = ?", [Number(id)]);
          for (const row of rows) {
            await run("DELETE FROM recordings WHERE id = ?", [row.recordingId]);
          }
        });
      }
      await refresh();
    },
    [refresh]
  );

  const deleteMemoirChapter = useCallback(
    async (memoirId: string, chapterNumber: number): Promise<BiographyBook | null> => {
      if (!isNativeDatabaseAvailable()) {
        const books = readFallbackBooks();
        const book = books.find((item) => item.id === memoirId);
        if (!book || book.chapters.length <= 1) return book || null;

        const updatedBook = {
          ...book,
          chapters: book.chapters
            .filter((chapter) => chapter.chapterNumber !== chapterNumber)
            .map((chapter, index) => ({ ...chapter, chapterNumber: index + 1 })),
        };
        writeFallbackBooks(books.map((item) => item.id === memoirId ? updatedBook : item));
        await refresh();
        return updatedBook;
      }

      await transaction(async () => {
        const chapters = await query<{ id: number; chapterNumber: number }>(
          `SELECT id, chapter_order AS chapterNumber
           FROM memoir_chapters
           WHERE memoir_id = ?
           ORDER BY chapter_order`,
          [Number(memoirId)]
        );
        if (chapters.length <= 1) throw new Error("마지막 목차는 삭제할 수 없습니다.");

        const target = chapters.find((chapter) => chapter.chapterNumber === chapterNumber);
        if (!target) throw new Error("삭제할 목차를 찾지 못했습니다.");

        const recordings = await query<{ recordingId: number }>(
          `SELECT DISTINCT recording_id AS recordingId
           FROM memoir_sections
           WHERE chapter_id = ? AND recording_id IS NOT NULL`,
          [target.id]
        );
        await run("DELETE FROM memoir_chapters WHERE id = ?", [target.id]);

        const remaining = chapters.filter((chapter) => chapter.id !== target.id);
        for (const [index, chapter] of remaining.entries()) {
          await run("UPDATE memoir_chapters SET chapter_order = ? WHERE id = ?", [index + 1, chapter.id]);
        }

        const latest = (
          await query<{ recordingId: number }>(
            `SELECT s.recording_id AS recordingId
             FROM memoir_sections s
             JOIN memoir_chapters c ON c.id = s.chapter_id
             WHERE c.memoir_id = ? AND s.recording_id IS NOT NULL
             ORDER BY c.chapter_order DESC, s.section_order DESC
             LIMIT 1`,
            [Number(memoirId)]
          )
        )[0];
        if (latest) {
          await run("UPDATE memoirs SET recording_id = ?, updated_at = ? WHERE id = ?", [
            latest.recordingId,
            new Date().toISOString(),
            Number(memoirId),
          ]);
        }

        for (const recording of recordings) {
          const referenced = (
            await query<{ count: number }>(
              `SELECT COUNT(*) AS count
               FROM memoir_sections
               WHERE recording_id = ?`,
              [recording.recordingId]
            )
          )[0];
          if (!referenced?.count) {
            await run("DELETE FROM recordings WHERE id = ?", [recording.recordingId]);
          }
        }
      });

      await refresh();
      return getMemoirById(memoirId);
    },
    [getMemoirById, refresh]
  );

  return {
    books,
    isLoading,
    error,
    saveMemoir,
    getMemoirs,
    getMemoirById,
    deleteMemoir,
    deleteMemoirChapter,
    refresh,
  };
}

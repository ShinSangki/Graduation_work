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
              `SELECT section_order AS sectionNumber, section_title AS title,
                      episode_id AS episodeId, time, place, summary, content
               FROM memoir_sections WHERE chapter_id = ? ORDER BY section_order`,
              [chapter.id]
            )
          ).map((section) => ({
            sectionNumber: section.sectionNumber,
            title: section.title,
            episodeId: section.episodeId,
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

        if (targetMemoirId) {
          await run(
            "UPDATE memoirs SET title = ?, updated_at = ?, recorded_at = ? WHERE id = ?",
            [book.title, now, book.recordedAt || now, targetMemoirId]
          );
          await run(
            `UPDATE recordings
             SET raw_text = ?
             WHERE id = (SELECT recording_id FROM memoirs WHERE id = ?)`,
            [book.rawText || null, targetMemoirId]
          );
          if (audioFileUri) {
            await run(
              `UPDATE recordings
               SET file_name = ?, file_path = ?, mime_type = ?
               WHERE id = (SELECT recording_id FROM memoirs WHERE id = ?)`,
              [
                fileNameFromUri(audioFileUri),
                audioFileUri,
                mimeTypeFromUri(audioFileUri),
                targetMemoirId,
              ]
            );
          }
          await run("DELETE FROM memoir_chapters WHERE memoir_id = ?", [targetMemoirId]);
        } else {
          const filePath = audioFileUri || "";
          const recording = await run(
            `INSERT INTO recordings
             (file_name, file_path, mime_type, file_size, raw_text, time, place, created_at)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
            [
              fileNameFromUri(filePath),
              filePath,
              mimeTypeFromUri(filePath),
              book.rawText || null,
              book.chapters[0]?.sections[0]?.time || null,
              book.chapters[0]?.sections[0]?.place || null,
              now,
            ]
          );
          const recordingId = recording.changes?.lastId;
          if (!recordingId) throw new Error("녹음 저장에 실패했습니다.");

          const memoir = await run(
            `INSERT INTO memoirs
             (recording_id, title, created_at, updated_at, recorded_at)
             VALUES (?, ?, ?, ?, ?)`,
            [recordingId, book.title, book.createdAt || now, now, book.recordedAt || now]
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
               (chapter_id, section_order, section_title, episode_id, time, place, summary, content)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                chapterId,
                section.sectionNumber,
                section.title,
                section.episodeId || null,
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
      return saved;
    },
    [refresh]
  );

  const deleteMemoir = useCallback(
    async (id: string) => {
      if (!isNativeDatabaseAvailable()) {
        writeFallbackBooks(readFallbackBooks().filter((book) => book.id !== id));
      } else {
        await transaction(async () => {
          const row = (
            await query<{ recordingId: number }>(
              "SELECT recording_id AS recordingId FROM memoirs WHERE id = ?",
              [Number(id)]
            )
          )[0];
          await run("DELETE FROM memoirs WHERE id = ?", [Number(id)]);
          if (row) await run("DELETE FROM recordings WHERE id = ?", [row.recordingId]);
        });
      }
      await refresh();
    },
    [refresh]
  );

  return { books, isLoading, error, saveMemoir, getMemoirs, getMemoirById, deleteMemoir, refresh };
}

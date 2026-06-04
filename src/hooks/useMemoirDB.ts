import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import { BiographyBook, getFirstBodyText, mergeMemoirBooks, sampleBiography } from "../data/sampleBiography";
import {
  initializeDatabase,
  isNativeDatabaseAvailable,
  query,
  run,
  transaction,
} from "../db/database";

const STORAGE_KEY = "memory_book_local_memoirs";
const STORAGE_CONSENT_KEY = "memory_book_storage_consent";
const MAX_MEMOIR_COUNT = 3;

export type MemoirSummary = {
  id: string;
  title: string;
  coverImage?: string;
  createdAt: string;
  preview?: string;
};

type MemoirRow = {
  id: number;
  title: string;
  coverImage?: string;
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

function upsertFallbackBook(book: BiographyBook) {
  const books = readFallbackBooks();
  const exists = books.some((item) => item.id === book.id);
  writeFallbackBooks(exists ? books.map((item) => item.id === book.id ? book : item) : [book, ...books]);
}

function seedFallbackBooks() {
  const stored = readFallbackBooks();
  if (stored.length > 0) return;
  writeFallbackBooks([sampleBiography]);
}

function createEmptyBook(id: string, title: string): BiographyBook {
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    chapters: [],
  };
}

function toSummary(book: BiographyBook): MemoirSummary {
  return {
    id: book.id,
    title: book.title,
    coverImage: book.coverImage,
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
  const [useFallbackStorage, setUseFallbackStorage] = useState(!isNativeDatabaseAvailable());
  const [storageReady, setStorageReady] = useState(!isNativeDatabaseAvailable());
  const [storageError, setStorageError] = useState("");
  const shouldUseFallbackStorage = useFallbackStorage || !isNativeDatabaseAvailable();

  const getMemoirs = useCallback(async (): Promise<MemoirSummary[]> => {
    if (shouldUseFallbackStorage) {
      seedFallbackBooks();
      return readFallbackBooks().map(toSummary);
    }

    const rows = await query<MemoirSummary>(`
    SELECT
        CAST(m.id AS TEXT) AS id,
        m.title,
        m.cover_image AS coverImage,
        m.created_at AS createdAt,
        COALESCE(SUBSTR(s.content, 1, 160), '') AS preview
      FROM memoirs m
      LEFT JOIN memoir_chapters c ON c.memoir_id = m.id AND c.chapter_order = 1
      LEFT JOIN memoir_sections s ON s.chapter_id = c.id AND s.section_order = 1
      ORDER BY m.updated_at DESC, m.id DESC
    `);
    return rows;
  }, [shouldUseFallbackStorage]);

  const getBiographyList = getMemoirs;

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

  const prepareStorage = useCallback(async () => {
    setIsLoading(true);
    setStorageError("");
    try {
      // Directory.Data is app-private storage. Older Android versions may still
      // show a platform permission dialog through the Filesystem plugin.
      await Filesystem.requestPermissions().catch(() => undefined);
      await initializeDatabase();
      window.localStorage.setItem(STORAGE_CONSENT_KEY, "accepted");
      setUseFallbackStorage(false);
      setStorageReady(true);
      setBooks(await getMemoirs());
      setError("");
    } catch (storageFailure) {
      console.error("SQLite storage preparation failed. Falling back to localStorage.", storageFailure);
      seedFallbackBooks();
      setUseFallbackStorage(true);
      setStorageReady(true);
      setBooks(readFallbackBooks().map(toSummary));
      setError("SQLite 저장소를 사용할 수 없어 임시 로컬 저장소로 전환했습니다.");
      setStorageError(
        storageFailure instanceof Error
          ? `저장공간을 준비하지 못했습니다: ${storageFailure.message}`
          : "저장공간을 준비하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [getMemoirs]);

  useEffect(() => {
    if (!isNativeDatabaseAvailable()) {
      seedFallbackBooks();
      void refresh();
      return;
    }

    if (window.localStorage.getItem(STORAGE_CONSENT_KEY) === "accepted") {
      void prepareStorage();
    } else {
      setIsLoading(false);
    }
  }, [prepareStorage, refresh]);

  const getMemoirById = useCallback(async (id: string): Promise<BiographyBook | null> => {
    if (shouldUseFallbackStorage) {
      seedFallbackBooks();
      return readFallbackBooks().find((book) => book.id === id) || null;
    }

    const memoir = (
      await query<MemoirRow>(
        `SELECT m.id, m.title, m.cover_image AS coverImage,
                m.created_at AS createdAt, m.recorded_at AS recordedAt,
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
      coverImage: memoir.coverImage,
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
  }, [shouldUseFallbackStorage]);

  const saveMemoir = useCallback(
    async (book: BiographyBook, audioFileUri?: string): Promise<BiographyBook> => {
      if (shouldUseFallbackStorage) {
        upsertFallbackBook(book);
        await refresh();
        return book;
      }

      try {
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
               SET title = ?, cover_image = ?, updated_at = ?, recorded_at = ?,
                   recording_id = COALESCE(?, recording_id)
               WHERE id = ?`,
              [book.title, book.coverImage || null, now, book.recordedAt || now, latestRecordingId, targetMemoirId]
            );
            await run("DELETE FROM memoir_chapters WHERE memoir_id = ?", [targetMemoirId]);
          } else {
            if (!latestRecordingId) throw new Error("신규 자서전에는 녹음 파일이 필요합니다.");

            const memoir = await run(
              `INSERT INTO memoirs
               (recording_id, title, cover_image, created_at, updated_at, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [latestRecordingId, book.title, book.coverImage || null, book.createdAt || now, now, book.recordedAt || now]
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
      } catch (saveFailure) {
        console.error("SQLite memoir save failed. Falling back to localStorage.", saveFailure);
        const fallbackBook = {
          ...book,
          id: book.id || `fallback-${Date.now()}`,
        };
        upsertFallbackBook(fallbackBook);
        setUseFallbackStorage(true);
        setError("SQLite 저장에 실패해 임시 로컬 저장소에 저장했습니다.");
        setBooks(readFallbackBooks().map(toSummary));
        return fallbackBook;
      }
    },
    [getMemoirById, refresh, shouldUseFallbackStorage]
  );

  const createNewBiography = useCallback(
    async (title: string): Promise<BiographyBook> => {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("자서전 제목을 입력해 주세요.");

      if (shouldUseFallbackStorage) {
        seedFallbackBooks();
        const books = readFallbackBooks();
        if (books.length >= MAX_MEMOIR_COUNT) {
          throw new Error("자서전은 최대 3개까지 만들 수 있습니다.");
        }
        const book = createEmptyBook(`memoir-${Date.now()}`, cleanTitle);
        writeFallbackBooks([book, ...books]);
        await refresh();
        return book;
      }

      try {
        const countRow = (await query<{ count: number }>("SELECT COUNT(*) AS count FROM memoirs"))[0];
        if ((countRow?.count || 0) >= MAX_MEMOIR_COUNT) {
          throw new Error("자서전은 최대 3개까지 만들 수 있습니다.");
        }

        const now = new Date().toISOString();
        const memoirId = await transaction(async () => {
          const recording = await run(
            `INSERT INTO recordings
             (file_name, file_path, mime_type, file_size, raw_text, time, place, created_at)
             VALUES (?, ?, ?, 0, NULL, NULL, NULL, ?)`,
            [`empty-${Date.now()}.txt`, "", "text/plain", now]
          );
          const recordingId = recording.changes?.lastId;
          if (!recordingId) throw new Error("기본 저장 슬롯을 만들지 못했습니다.");

          const memoir = await run(
            `INSERT INTO memoirs
             (recording_id, title, cover_image, created_at, updated_at, recorded_at)
             VALUES (?, ?, NULL, ?, ?, ?)`,
            [recordingId, cleanTitle, now, now, now]
          );
          const insertedId = memoir.changes?.lastId;
          if (!insertedId) throw new Error("자서전을 만들지 못했습니다.");
          return insertedId;
        });

        await refresh();
        return (await getMemoirById(String(memoirId))) || createEmptyBook(String(memoirId), cleanTitle);
      } catch (createFailure) {
        console.error("SQLite biography create failed.", createFailure);
        throw createFailure instanceof Error
          ? createFailure
          : new Error("새 자서전을 만들지 못했습니다.");
      }
    },
    [getMemoirById, refresh, shouldUseFallbackStorage]
  );

  const saveMemoirToBiographies = useCallback(
    async (
      generatedBook: BiographyBook,
      biographyIds: string[],
      audioFileUri?: string
    ): Promise<BiographyBook[]> => {
      const targetIds = [...new Set(biographyIds)].filter(Boolean);
      if (targetIds.length === 0) throw new Error("저장할 자서전을 선택해 주세요.");
      if (targetIds.length > MAX_MEMOIR_COUNT) throw new Error("자서전은 최대 3개까지 선택할 수 있습니다.");

      const savedBooks: BiographyBook[] = [];
      for (const biographyId of targetIds) {
        const currentBook = await getMemoirById(biographyId);
        if (!currentBook) throw new Error("선택한 자서전을 찾지 못했습니다.");
        savedBooks.push(await saveMemoir(mergeMemoirBooks(currentBook, generatedBook), audioFileUri));
      }
      return savedBooks;
    },
    [getMemoirById, saveMemoir]
  );

  const updateMemoirCover = useCallback(
    async (memoirId: string, coverImage: string): Promise<BiographyBook | null> => {
      if (shouldUseFallbackStorage) {
        const books = readFallbackBooks();
        const updatedBooks = books.map((book) =>
          book.id === memoirId ? { ...book, coverImage } : book
        );
        writeFallbackBooks(updatedBooks);
        await refresh();
        return updatedBooks.find((book) => book.id === memoirId) || null;
      }

      try {
        await run("UPDATE memoirs SET cover_image = ?, updated_at = ? WHERE id = ?", [
          coverImage,
          new Date().toISOString(),
          Number(memoirId),
        ]);
        await refresh();
        return getMemoirById(memoirId);
      } catch (coverFailure) {
        console.error("SQLite cover update failed. Falling back to localStorage.", coverFailure);
        setUseFallbackStorage(true);
        return null;
      }
    },
    [getMemoirById, refresh, shouldUseFallbackStorage]
  );

  const deleteMemoir = useCallback(
    async (id: string) => {
      if (shouldUseFallbackStorage) {
        writeFallbackBooks(readFallbackBooks().filter((book) => book.id !== id));
      } else {
        try {
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
        } catch (deleteFailure) {
          console.error("SQLite memoir delete failed. Falling back to localStorage.", deleteFailure);
          setUseFallbackStorage(true);
          writeFallbackBooks(readFallbackBooks().filter((book) => book.id !== id));
        }
      }
      await refresh();
    },
    [refresh, shouldUseFallbackStorage]
  );

  const deleteMemoirChapter = useCallback(
    async (memoirId: string, chapterNumber: number): Promise<BiographyBook | null> => {
      if (shouldUseFallbackStorage) {
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

      try {
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
      } catch (deleteFailure) {
        console.error("SQLite chapter delete failed. Falling back to localStorage.", deleteFailure);
        setUseFallbackStorage(true);
        return null;
      }

      await refresh();
      return getMemoirById(memoirId);
    },
    [getMemoirById, refresh, shouldUseFallbackStorage]
  );

  return {
    books,
    isLoading,
    error,
    storageReady,
    storageError,
    prepareStorage,
    saveMemoir,
    saveMemoirToBiographies,
    getBiographyList,
    createNewBiography,
    updateMemoirCover,
    getMemoirs,
    getMemoirById,
    deleteMemoir,
    deleteMemoirChapter,
    refresh,
  };
}

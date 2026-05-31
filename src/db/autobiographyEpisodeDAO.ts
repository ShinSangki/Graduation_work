import { initializeDatabase, isNativeDatabaseAvailable, query, run } from "./database";

const FALLBACK_STORAGE_KEY = "memory_book_local_episodes";

export type EpisodeData = {
  episode_id: string;
  title: string;
  content: string;
  stt_raw: string;
  source_audio?: string | null;
  tags?: string[];
  stt_length?: number | null;
  summary_length?: number | null;
  compression_rate?: number | null;
  llm_model?: string | null;
  created_at?: string;
};

export type SavedEpisode = Omit<EpisodeData, "tags"> & {
  id: number;
  tags: string[];
  created_at: string;
};

type EpisodeRow = Omit<SavedEpisode, "tags"> & {
  tags: string | null;
};

function readFallbackEpisodes(): SavedEpisode[] {
  try {
    return JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeFallbackEpisodes(episodes: SavedEpisode[]) {
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(episodes));
}

/**
 * 앱 시작 시 호출한다. 기존 DB 초기화 과정에서 에피소드 테이블도 생성된다.
 */
export async function initDatabase() {
  await initializeDatabase();
}

/**
 * SQL 파라미터 바인딩을 사용해 에피소드를 안전하게 저장한다.
 * tags 배열은 요구사항에 따라 쉼표 구분 문자열로 저장한다.
 */
export async function saveEpisode(episode: EpisodeData) {
  if (!isNativeDatabaseAvailable()) {
    const episodes = readFallbackEpisodes();
    if (episodes.some((item) => item.episode_id === episode.episode_id)) {
      throw new Error("이미 저장된 에피소드입니다.");
    }

    const id = Math.max(0, ...episodes.map((item) => item.id)) + 1;
    writeFallbackEpisodes([
      {
        ...episode,
        id,
        tags: episode.tags ?? [],
        created_at: episode.created_at ?? new Date().toISOString(),
      },
      ...episodes,
    ]);
    return id;
  }

  const result = await run(
    `INSERT INTO autobiography_episode (
      episode_id, title, content, stt_raw, source_audio, tags,
      stt_length, summary_length, compression_rate, llm_model, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [
      episode.episode_id,
      episode.title,
      episode.content,
      episode.stt_raw,
      episode.source_audio ?? null,
      episode.tags?.join(",") ?? null,
      episode.stt_length ?? null,
      episode.summary_length ?? null,
      episode.compression_rate ?? null,
      episode.llm_model ?? null,
      episode.created_at ?? null,
    ]
  );

  return result.changes?.lastId ?? null;
}

/**
 * 저장된 에피소드를 최신순으로 읽고 tags를 다시 배열로 변환한다.
 */
export async function getAllEpisodes(): Promise<SavedEpisode[]> {
  if (!isNativeDatabaseAvailable()) {
    return readFallbackEpisodes().sort(
      (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id
    );
  }

  const rows = await query<EpisodeRow>(
    `SELECT *
     FROM autobiography_episode
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map((row) => ({
    ...row,
    tags: row.tags ? row.tags.split(",") : [],
  }));
}

/**
 * 한 생성 에피소드를 특정 자서전 섹션에 연결한다.
 * UNIQUE 인덱스가 같은 에피소드의 중복 연결을 DB 레벨에서 차단한다.
 */
export async function linkEpisodeToSection(sectionId: number, episodeId: string) {
  if (!isNativeDatabaseAvailable()) {
    throw new Error("에피소드-섹션 연결은 네이티브 SQLite 환경에서만 지원합니다.");
  }

  await run(
    `UPDATE memoir_sections
     SET episode_id = ?
     WHERE id = ?`,
    [episodeId, sectionId]
  );
}

export async function unlinkEpisodeFromSection(sectionId: number) {
  if (!isNativeDatabaseAvailable()) {
    throw new Error("에피소드-섹션 연결은 네이티브 SQLite 환경에서만 지원합니다.");
  }

  await run(
    `UPDATE memoir_sections
     SET episode_id = NULL
     WHERE id = ?`,
    [sectionId]
  );
}

export const DATABASE_NAME = "memory-book";

export const CREATE_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    raw_text TEXT,
    time TEXT,
    place TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memoirs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    cover_image TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    recorded_at TEXT,
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memoir_chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memoir_id INTEGER NOT NULL,
    chapter_order INTEGER NOT NULL,
    chapter_title TEXT NOT NULL,
    FOREIGN KEY (memoir_id) REFERENCES memoirs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS autobiography_episode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    stt_raw TEXT NOT NULL,
    source_audio TEXT,
    tags TEXT,
    stt_length INTEGER CHECK (stt_length >= 0),
    summary_length INTEGER CHECK (summary_length >= 0),
    compression_rate REAL CHECK (compression_rate >= 0),
    llm_model TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memoir_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    section_order INTEGER NOT NULL,
    section_title TEXT NOT NULL,
    recording_id INTEGER,
    raw_text TEXT,
    time TEXT,
    place TEXT,
    summary TEXT,
    content TEXT NOT NULL,
    episode_id TEXT UNIQUE,
    FOREIGN KEY (chapter_id) REFERENCES memoir_chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES autobiography_episode(episode_id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_autobiography_episode_created_at
    ON autobiography_episode(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_memoir_sections_recording_id
    ON memoir_sections(recording_id);
`;

export const ADD_EPISODE_ID_TO_MEMOIR_SECTIONS = `
  ALTER TABLE memoir_sections
    ADD COLUMN episode_id TEXT
    REFERENCES autobiography_episode(episode_id)
    ON DELETE SET NULL;
`;

export const ADD_RAW_TEXT_TO_MEMOIR_SECTIONS = `
  ALTER TABLE memoir_sections
    ADD COLUMN raw_text TEXT;
`;

export const ADD_RECORDING_ID_TO_MEMOIR_SECTIONS = `
  ALTER TABLE memoir_sections
    ADD COLUMN recording_id INTEGER
    REFERENCES recordings(id)
    ON DELETE SET NULL;
`;

export const CREATE_MEMOIR_SECTION_EPISODE_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_memoir_sections_episode_id
    ON memoir_sections(episode_id);
`;

export const CREATE_MEMOIR_SECTION_RECORDING_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_memoir_sections_recording_id
    ON memoir_sections(recording_id);
`;

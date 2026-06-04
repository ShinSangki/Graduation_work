import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite } from "@capacitor-community/sqlite";
import {
  ADD_EPISODE_ID_TO_MEMOIR_SECTIONS,
  ADD_RECORDING_ID_TO_MEMOIR_SECTIONS,
  ADD_RAW_TEXT_TO_MEMOIR_SECTIONS,
  CREATE_MEMOIR_SECTION_EPISODE_INDEX,
  CREATE_MEMOIR_SECTION_RECORDING_INDEX,
  CREATE_SCHEMA,
  DATABASE_NAME,
} from "./schema";

const DB_OPTIONS = { database: DATABASE_NAME };
let initialization: Promise<void> | null = null;
let transactionQueue: Promise<void> = Promise.resolve();

type TableInfoRow = {
  name: string;
};

export function isNativeDatabaseAvailable() {
  return Capacitor.isNativePlatform();
}

export async function initializeDatabase() {
  if (!isNativeDatabaseAvailable()) return;
  if (initialization) return initialization;

  initialization = (async () => {
    const consistency = await CapacitorSQLite.checkConnectionsConsistency({
      dbNames: [DATABASE_NAME],
      openModes: ["RW"],
    });

    if (!consistency.result) {
      await CapacitorSQLite.createConnection({
        database: DATABASE_NAME,
        version: 1,
        encrypted: false,
        mode: "no-encryption",
        readonly: false,
      });
    }

    const opened = await CapacitorSQLite.isDBOpen(DB_OPTIONS);
    if (!opened.result) await CapacitorSQLite.open(DB_OPTIONS);
    await CapacitorSQLite.execute({
      database: DATABASE_NAME,
      statements: CREATE_SCHEMA,
    });

    const columns = await CapacitorSQLite.query({
      database: DATABASE_NAME,
      statement: "PRAGMA table_info(memoir_sections)",
      values: [],
    });
    const hasEpisodeId = (columns.values as TableInfoRow[] | undefined)?.some(
      (column) => column.name === "episode_id"
    );
    const hasRawText = (columns.values as TableInfoRow[] | undefined)?.some(
      (column) => column.name === "raw_text"
    );
    const hasRecordingId = (columns.values as TableInfoRow[] | undefined)?.some(
      (column) => column.name === "recording_id"
    );

    if (!hasEpisodeId) {
      await CapacitorSQLite.execute({
        database: DATABASE_NAME,
        statements: ADD_EPISODE_ID_TO_MEMOIR_SECTIONS,
      });
    }

    if (!hasRawText) {
      await CapacitorSQLite.execute({
        database: DATABASE_NAME,
        statements: ADD_RAW_TEXT_TO_MEMOIR_SECTIONS,
      });
    }

    if (!hasRecordingId) {
      await CapacitorSQLite.execute({
        database: DATABASE_NAME,
        statements: ADD_RECORDING_ID_TO_MEMOIR_SECTIONS,
      });
    }

    await CapacitorSQLite.execute({
      database: DATABASE_NAME,
      statements: CREATE_MEMOIR_SECTION_EPISODE_INDEX,
    });
    await CapacitorSQLite.execute({
      database: DATABASE_NAME,
      statements: CREATE_MEMOIR_SECTION_RECORDING_INDEX,
    });
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

export async function run(sql: string, values: any[] = []) {
  await initializeDatabase();
  return CapacitorSQLite.run({
    database: DATABASE_NAME,
    statement: sql,
    values,
    transaction: false,
  });
}

export async function query<T>(sql: string, values: any[] = []) {
  await initializeDatabase();
  const result = await CapacitorSQLite.query({
    database: DATABASE_NAME,
    statement: sql,
    values,
  });
  return (result.values || []) as T[];
}

export async function transaction<T>(work: () => Promise<T>) {
  const previous = transactionQueue;
  let release!: () => void;
  transactionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    await initializeDatabase();
    const active = await CapacitorSQLite.isTransactionActive(DB_OPTIONS);
    if (active.result) {
      await CapacitorSQLite.rollbackTransaction(DB_OPTIONS);
    }

    await CapacitorSQLite.beginTransaction(DB_OPTIONS);
    try {
      const result = await work();
      await CapacitorSQLite.commitTransaction(DB_OPTIONS);
      return result;
    } catch (error) {
      const stillActive = await CapacitorSQLite.isTransactionActive(DB_OPTIONS);
      if (stillActive.result) await CapacitorSQLite.rollbackTransaction(DB_OPTIONS);
      throw error;
    }
  } finally {
    release();
  }
}

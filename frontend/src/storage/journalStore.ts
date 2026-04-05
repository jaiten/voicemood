import * as SQLite from "expo-sqlite";

import { JournalEntry, JournalEntryType, MoodLabel, NoteResult, PickedAudioFile, SaveEntriesResult, SaveEntryResult, ToneLabel } from "../types";
import { getCanonicalEntryDate, getDayKey } from "../utils/dates";

const DATABASE_NAME = "voicemood.db";
const TABLE_NAME = "journal_entries";
const LEGACY_TABLE_NAME = "voice_memo_analysis";

type JournalEntryRow = {
  id: string;
  entry_type: string;
  title: string | null;
  filename: string | null;
  text_content: string | null;
  audio_uri: string | null;
  transcript: string | null;
  summary: string | null;
  source_created_at: string | null;
  source_modified_at: string | null;
  source_file_size: number | null;
  imported_at: string;
  created_at: string;
  day_key: string;
  happiness_score: number;
  transcript_sentiment_score: number | null;
  acoustic_tone_score: number | null;
  label: string | null;
  tone_label: string | null;
  duration_sec: number | null;
  audio_features_json: string | null;
  duplicate_key: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function parseMoodLabel(value: string | null): MoodLabel {
  if (value === "Low" || value === "Neutral" || value === "High") {
    return value;
  }

  return "Neutral";
}

function parseToneLabel(value: string | null): ToneLabel | null {
  if (value === "Calm" || value === "Animated" || value === "Flat" || value === "Tense" || value === "Subdued") {
    return value;
  }

  return null;
}

function parseEntryType(value: string | null): JournalEntryType {
  if (value === "imported_audio" || value === "recorded_audio" || value === "text") {
    return value;
  }

  return "imported_audio";
}

function createEntryId(entryType: JournalEntryType, createdAt: string, suffix: string): string {
  const seed = Math.random().toString(36).slice(2, 8);
  return `${entryType}-${createdAt}-${suffix}-${seed}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 72);
}

function parseAudioFeatures(jsonValue: string | null) {
  if (!jsonValue) {
    return null;
  }

  try {
    return JSON.parse(jsonValue);
  } catch {
    return null;
  }
}

function mapRowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    entryType: parseEntryType(row.entry_type),
    title: row.title,
    filename: row.filename,
    textContent: row.text_content,
    audioUri: row.audio_uri,
    transcript: row.transcript,
    summary: row.summary,
    sourceCreatedAt: row.source_created_at,
    sourceModifiedAt: row.source_modified_at,
    sourceFileSize: row.source_file_size,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    dayKey: row.day_key,
    happinessScore: row.happiness_score,
    transcriptSentimentScore: row.transcript_sentiment_score,
    acousticToneScore: row.acoustic_tone_score,
    label: parseMoodLabel(row.label),
    toneLabel: parseToneLabel(row.tone_label),
    durationSec: row.duration_sec,
    audioFeatures: parseAudioFeatures(row.audio_features_json),
  };
}

function normalizeForFingerprint(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 1200) ?? "";
}

function roundValue(value?: number | null, decimals = 1): string {
  if (typeof value !== "number") {
    return "";
  }

  return value.toFixed(decimals);
}

function hashString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

function buildDuplicateKey(entry: JournalEntry): string {
  const transcriptFingerprint = normalizeForFingerprint(entry.transcript || entry.textContent);
  const titleFingerprint = normalizeForFingerprint(entry.title);
  const filenameFingerprint = normalizeForFingerprint(entry.filename);
  const duplicatePayload =
    entry.entryType === "text"
      ? [
          entry.entryType,
          titleFingerprint,
          normalizeForFingerprint(entry.textContent || entry.transcript),
        ]
      : entry.entryType === "recorded_audio"
        ? [
            entry.entryType,
            normalizeForFingerprint(entry.audioUri),
            titleFingerprint,
            roundValue(entry.sourceFileSize, 0),
            roundValue(entry.durationSec, 1),
            transcriptFingerprint,
          ]
        : [
            entry.entryType,
            filenameFingerprint,
            normalizeForFingerprint(entry.sourceCreatedAt),
            normalizeForFingerprint(entry.sourceModifiedAt),
            roundValue(entry.sourceFileSize, 0),
            roundValue(entry.durationSec, 1),
            transcriptFingerprint,
          ];

  return `${entry.entryType}:${hashString(duplicatePayload.join("|"))}`;
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeJournalStore();
  }

  return databasePromise;
}

async function tableExists(db: SQLite.SQLiteDatabase, tableName: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );

  return !!row?.name;
}

async function columnExists(db: SQLite.SQLiteDatabase, tableName: string, columnName: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

async function ensureColumn(db: SQLite.SQLiteDatabase, tableName: string, columnName: string, definition: string): Promise<void> {
  if (await columnExists(db, tableName, columnName)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

async function migrateLegacyVoiceMemoRows(db: SQLite.SQLiteDatabase): Promise<void> {
  const hasLegacyTable = await tableExists(db, LEGACY_TABLE_NAME);
  if (!hasLegacyTable) {
    return;
  }

  await db.execAsync(`
    INSERT OR IGNORE INTO ${TABLE_NAME} (
      id,
      entry_type,
      title,
      filename,
      text_content,
      audio_uri,
      transcript,
      summary,
      source_created_at,
      source_modified_at,
      source_file_size,
      imported_at,
      created_at,
      day_key,
      happiness_score,
      transcript_sentiment_score,
      acoustic_tone_score,
      label,
      tone_label,
      duration_sec,
      audio_features_json,
      duplicate_key
    )
    SELECT
      id,
      'imported_audio',
      NULL,
      filename,
      NULL,
      NULL,
      transcript,
      summary,
      NULL,
      NULL,
      NULL,
      created_at,
      created_at,
      day_key,
      happiness_score,
      transcript_sentiment_score,
      acoustic_tone_score,
      COALESCE(label, 'Neutral'),
      tone_label,
      duration_sec,
      audio_features_json,
      NULL
    FROM ${LEGACY_TABLE_NAME};
  `);
}

async function findEntryByDuplicateKey(db: SQLite.SQLiteDatabase, duplicateKey: string): Promise<JournalEntry | null> {
  const row = await db.getFirstAsync<JournalEntryRow>(
    `SELECT * FROM ${TABLE_NAME} WHERE duplicate_key = ? LIMIT 1`,
    [duplicateKey],
  );

  return row ? mapRowToJournalEntry(row) : null;
}

async function insertJournalEntry(db: SQLite.SQLiteDatabase, entry: JournalEntry, duplicateKey: string): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ${TABLE_NAME} (
      id,
      entry_type,
      title,
      filename,
      text_content,
      audio_uri,
      transcript,
      summary,
      source_created_at,
      source_modified_at,
      source_file_size,
      imported_at,
      created_at,
      day_key,
      happiness_score,
      transcript_sentiment_score,
      acoustic_tone_score,
      label,
      tone_label,
      duration_sec,
      audio_features_json,
      duplicate_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.entryType,
    entry.title ?? null,
    entry.filename ?? null,
    entry.textContent ?? null,
    entry.audioUri ?? null,
    entry.transcript ?? null,
    entry.summary ?? null,
    entry.sourceCreatedAt ?? null,
    entry.sourceModifiedAt ?? null,
    entry.sourceFileSize ?? null,
    entry.importedAt,
    entry.createdAt,
    entry.dayKey,
    entry.happinessScore,
    entry.transcriptSentimentScore ?? null,
    entry.acousticToneScore ?? null,
    entry.label,
    entry.toneLabel ?? null,
    entry.durationSec ?? null,
    entry.audioFeatures ? JSON.stringify(entry.audioFeatures) : null,
    duplicateKey,
  );
}

async function persistEntry(db: SQLite.SQLiteDatabase, entry: JournalEntry): Promise<SaveEntryResult> {
  const duplicateKey = buildDuplicateKey(entry);
  const existingEntry = await findEntryByDuplicateKey(db, duplicateKey);

  if (existingEntry) {
    return {
      status: "duplicate",
      entry: existingEntry,
    };
  }

  await insertJournalEntry(db, entry, duplicateKey);

  return {
    status: "saved",
    entry,
  };
}

async function backfillDuplicateKeys(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<JournalEntryRow>(
    `SELECT * FROM ${TABLE_NAME} WHERE duplicate_key IS NULL OR duplicate_key = '' ORDER BY created_at ASC, id ASC`,
  );

  for (const row of rows) {
    const entry = mapRowToJournalEntry(row);
    const duplicateKey = buildDuplicateKey(entry);
    const existing = await findEntryByDuplicateKey(db, duplicateKey);

    if (existing && existing.id !== entry.id) {
      continue;
    }

    await db.runAsync(`UPDATE ${TABLE_NAME} SET duplicate_key = ? WHERE id = ?`, duplicateKey, entry.id);
  }
}

function buildBaseJournalEntry(params: {
  entryType: JournalEntryType;
  title?: string | null;
  filename?: string | null;
  textContent?: string | null;
  audioUri?: string | null;
  transcript?: string | null;
  summary?: string | null;
  sourceCreatedAt?: string | null;
  sourceModifiedAt?: string | null;
  sourceFileSize?: number | null;
  importedAt: string;
  happinessScore: number;
  transcriptSentimentScore?: number | null;
  acousticToneScore?: number | null;
  label: MoodLabel;
  toneLabel?: ToneLabel | null;
  durationSec?: number | null;
  audioFeatures?: JournalEntry["audioFeatures"];
  suffix: string;
}): JournalEntry {
  const createdAt = getCanonicalEntryDate({
    sourceCreatedAt: params.sourceCreatedAt,
    sourceModifiedAt: params.sourceModifiedAt,
    importedAt: params.importedAt,
  });

  return {
    id: createEntryId(params.entryType, createdAt, params.suffix),
    entryType: params.entryType,
    title: params.title ?? null,
    filename: params.filename ?? null,
    textContent: params.textContent ?? null,
    audioUri: params.audioUri ?? null,
    transcript: params.transcript ?? null,
    summary: params.summary ?? null,
    sourceCreatedAt: params.sourceCreatedAt ?? null,
    sourceModifiedAt: params.sourceModifiedAt ?? null,
    sourceFileSize: params.sourceFileSize ?? null,
    importedAt: params.importedAt,
    createdAt,
    dayKey: getDayKey(createdAt),
    happinessScore: params.happinessScore,
    transcriptSentimentScore: params.transcriptSentimentScore ?? null,
    acousticToneScore: params.acousticToneScore ?? null,
    label: params.label,
    toneLabel: params.toneLabel ?? null,
    durationSec: params.durationSec ?? null,
    audioFeatures: params.audioFeatures ?? null,
  };
}

export async function initializeJournalStore(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        entry_type TEXT NOT NULL,
        title TEXT,
        filename TEXT,
        text_content TEXT,
        audio_uri TEXT,
        transcript TEXT,
        summary TEXT,
        source_created_at TEXT,
        source_modified_at TEXT,
        source_file_size REAL,
        imported_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        day_key TEXT NOT NULL,
        happiness_score REAL NOT NULL,
        transcript_sentiment_score REAL,
        acoustic_tone_score REAL,
        label TEXT NOT NULL,
        tone_label TEXT,
        duration_sec REAL,
        audio_features_json TEXT,
        duplicate_key TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON ${TABLE_NAME} (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_journal_entries_day_key ON ${TABLE_NAME} (day_key);
    `);

    await ensureColumn(db, TABLE_NAME, "source_file_size", "REAL");
    await ensureColumn(db, TABLE_NAME, "duplicate_key", "TEXT");
    await migrateLegacyVoiceMemoRows(db);
    await db.execAsync(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_duplicate_key ON ${TABLE_NAME} (duplicate_key) WHERE duplicate_key IS NOT NULL;`,
    );
    await backfillDuplicateKeys(db);

    return db;
  })();

  return databasePromise;
}

export async function saveImportedAudioEntries(files: PickedAudioFile[], results: NoteResult[]): Promise<SaveEntriesResult> {
  const db = await getDatabase();
  const savedEntries: JournalEntry[] = [];
  const duplicateEntries: JournalEntry[] = [];

  for (const [index, result] of results.entries()) {
    if (result.status !== "success" || typeof result.overall_happiness_score !== "number" || !result.label) {
      continue;
    }

    const file = files[index];
    const importedAt = file?.importedAt ?? new Date(Date.now() + index).toISOString();
    const entry = buildBaseJournalEntry({
      entryType: "imported_audio",
      filename: result.filename || file?.name || "Imported note",
      audioUri: file?.uri ?? null,
      transcript: result.transcript ?? null,
      summary: result.summary ?? null,
      sourceCreatedAt: file?.sourceCreatedAt ?? null,
      sourceModifiedAt: file?.sourceModifiedAt ?? null,
      sourceFileSize: file?.size ?? null,
      importedAt,
      happinessScore: result.overall_happiness_score,
      transcriptSentimentScore: result.transcript_sentiment_score ?? null,
      acousticToneScore: result.acoustic_tone_score ?? null,
      label: result.label,
      toneLabel: result.tone_label ?? null,
      durationSec: result.audio_features?.duration_seconds ?? null,
      audioFeatures: result.audio_features ?? null,
      suffix: `${index}-${result.filename}`,
    });

    const saveResult = await persistEntry(db, entry);
    if (saveResult.status === "saved") {
      savedEntries.push(saveResult.entry);
    } else {
      duplicateEntries.push(saveResult.entry);
    }
  }

  return {
    savedEntries,
    duplicateEntries,
  };
}

export async function saveRecordedAudioEntry(params: {
  analysis: NoteResult;
  file: PickedAudioFile;
  title?: string | null;
}): Promise<SaveEntryResult | null> {
  const db = await getDatabase();
  const { analysis, file, title } = params;

  if (analysis.status !== "success" || typeof analysis.overall_happiness_score !== "number" || !analysis.label) {
    return null;
  }

  const importedAt = file.importedAt ?? new Date().toISOString();
  const entry = buildBaseJournalEntry({
    entryType: "recorded_audio",
    title: title?.trim() || null,
    filename: analysis.filename || file.name || "Voice note",
    audioUri: file.uri,
    transcript: analysis.transcript ?? null,
    summary: analysis.summary ?? null,
    sourceCreatedAt: file.sourceCreatedAt ?? null,
    sourceModifiedAt: file.sourceModifiedAt ?? null,
    sourceFileSize: file.size ?? null,
    importedAt,
    happinessScore: analysis.overall_happiness_score,
    transcriptSentimentScore: analysis.transcript_sentiment_score ?? null,
    acousticToneScore: analysis.acoustic_tone_score ?? null,
    label: analysis.label,
    toneLabel: analysis.tone_label ?? null,
    durationSec: analysis.audio_features?.duration_seconds ?? null,
    audioFeatures: analysis.audio_features ?? null,
    suffix: analysis.filename || file.name || "recording",
  });

  return persistEntry(db, entry);
}

export async function saveTextJournalEntry(params: {
  title?: string | null;
  textContent: string;
  analysis: NoteResult;
}): Promise<SaveEntryResult | null> {
  const db = await getDatabase();
  const { title, textContent, analysis } = params;

  if (analysis.status !== "success" || typeof analysis.overall_happiness_score !== "number" || !analysis.label) {
    return null;
  }

  const importedAt = new Date().toISOString();
  const entry = buildBaseJournalEntry({
    entryType: "text",
    title: title?.trim() || null,
    filename: null,
    textContent,
    transcript: analysis.transcript ?? textContent,
    summary: analysis.summary ?? null,
    importedAt,
    happinessScore: analysis.overall_happiness_score,
    transcriptSentimentScore: analysis.transcript_sentiment_score ?? null,
    acousticToneScore: null,
    label: analysis.label,
    toneLabel: null,
    durationSec: null,
    audioFeatures: null,
    suffix: title?.trim() || "text-note",
  });

  return persistEntry(db, entry);
}

export async function getLatestJournalEntries(limit = 100): Promise<JournalEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<JournalEntryRow>(
    `SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC, imported_at DESC, id DESC LIMIT ?`,
    [limit],
  );

  return rows.map(mapRowToJournalEntry);
}

export async function getJournalEntriesByDateRange(startDayKey: string, endDayKey: string): Promise<JournalEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<JournalEntryRow>(
    `SELECT * FROM ${TABLE_NAME}
     WHERE day_key >= ? AND day_key <= ?
     ORDER BY created_at DESC, imported_at DESC, id DESC`,
    [startDayKey, endDayKey],
  );

  return rows.map(mapRowToJournalEntry);
}

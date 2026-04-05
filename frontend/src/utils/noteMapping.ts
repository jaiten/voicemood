import { JournalEntry, JournalEntryType, MoodLabel, NoteResult, PickedAudioFile } from "../types";
import { getCanonicalEntryDate, getDayKey } from "./dates";


function labelForScore(score: number | null | undefined): MoodLabel | null {
  if (typeof score !== "number") {
    return null;
  }

  if (score <= 39) {
    return "Low";
  }

  if (score <= 69) {
    return "Neutral";
  }

  return "High";
}

export function journalEntryToNoteResult(entry: JournalEntry): NoteResult {
  return {
    filename: entry.filename || entry.title || "Journal entry",
    status: "success",
    transcript: entry.transcript ?? entry.textContent ?? null,
    transcript_sentiment_score: entry.transcriptSentimentScore ?? null,
    transcript_label: labelForScore(entry.transcriptSentimentScore) ?? entry.label ?? null,
    acoustic_tone_score: entry.acousticToneScore ?? null,
    overall_happiness_score: entry.happinessScore,
    label: entry.label ?? labelForScore(entry.happinessScore) ?? "Neutral",
    tone_label: entry.toneLabel ?? null,
    summary: entry.summary ?? null,
    audio_features: entry.audioFeatures ?? null,
  };
}

export function noteResultToJournalEntry(
  note: NoteResult,
  params: {
    entryType: JournalEntryType;
    file?: PickedAudioFile;
    title?: string | null;
    textContent?: string | null;
  },
): JournalEntry {
  const importedAt = params.file?.importedAt ?? new Date().toISOString();
  const createdAt = getCanonicalEntryDate({
    sourceCreatedAt: params.file?.sourceCreatedAt ?? null,
    sourceModifiedAt: params.file?.sourceModifiedAt ?? null,
    importedAt,
  });
  const fallbackLabel = labelForScore(note.overall_happiness_score) ?? "Neutral";
  const filename =
    params.entryType === "text" ? null : note.filename || params.file?.name || params.title || "Voice note";

  return {
    id: `preview-${params.entryType}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9_-]/g, ""),
    entryType: params.entryType,
    title: params.title ?? null,
    filename,
    textContent: params.textContent ?? null,
    audioUri: params.file?.uri ?? null,
    transcript: note.transcript ?? params.textContent ?? null,
    summary: note.summary ?? null,
    sourceCreatedAt: params.file?.sourceCreatedAt ?? null,
    sourceModifiedAt: params.file?.sourceModifiedAt ?? null,
    importedAt,
    createdAt,
    dayKey: getDayKey(createdAt),
    happinessScore: note.overall_happiness_score ?? 0,
    transcriptSentimentScore: note.transcript_sentiment_score ?? null,
    acousticToneScore: note.acoustic_tone_score ?? null,
    label: note.label ?? fallbackLabel,
    toneLabel: note.tone_label ?? null,
    durationSec: note.audio_features?.duration_seconds ?? null,
    audioFeatures: note.audio_features ?? null,
  };
}

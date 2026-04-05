export type RootTabName = "today" | "timeline" | "history" | "capture";
export type ScreenName = RootTabName | "results" | "detail";
export type CaptureMode = "import" | "record" | "text";
export type TimelineMode = "week" | "month";
export type NoticeTone = "info" | "warning";

export type MoodLabel = "Low" | "Neutral" | "High";
export type ToneLabel = "Calm" | "Animated" | "Flat" | "Tense" | "Subdued";
export type ResultStatus = "success" | "error";
export type JournalEntryType = "imported_audio" | "recorded_audio" | "text";

export type PickedAudioFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  sourceCreatedAt?: string | null;
  sourceModifiedAt?: string | null;
  importedAt?: string;
};

export type AudioFeatures = {
  duration_seconds?: number | null;
  active_speech_seconds?: number | null;
  voiced_ratio?: number | null;
  pause_ratio?: number | null;
  pitch_mean?: number | null;
  pitch_median?: number | null;
  pitch_std?: number | null;
  rms_mean?: number | null;
  rms_std?: number | null;
  intensity_db_mean?: number | null;
  speaking_rate_estimate?: number | null;
  spectral_centroid_mean?: number | null;
  zero_crossing_rate_mean?: number | null;
};

export type NoteResult = {
  filename: string;
  status: ResultStatus;
  transcript?: string | null;
  transcript_sentiment_score?: number | null;
  transcript_label?: MoodLabel | null;
  keyword_adjustment_score?: number | null;
  acoustic_tone_score?: number | null;
  overall_happiness_score?: number | null;
  label?: MoodLabel | null;
  tone_label?: ToneLabel | null;
  summary?: string | null;
  audio_features?: AudioFeatures | null;
  error?: string | null;
};

export type AnalysisResponse = {
  average_happiness: number;
  overall_label: MoodLabel;
  count: number;
  successful_count: number;
  failed_count: number;
  results: NoteResult[];
};

export type JournalEntry = {
  id: string;
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
  createdAt: string;
  dayKey: string;
  happinessScore: number;
  transcriptSentimentScore?: number | null;
  acousticToneScore?: number | null;
  label: MoodLabel;
  toneLabel?: ToneLabel | null;
  durationSec?: number | null;
  audioFeatures?: AudioFeatures | null;
};

export type SaveEntriesResult = {
  savedEntries: JournalEntry[];
  duplicateEntries: JournalEntry[];
};

export type SaveEntryResult =
  | {
      status: "saved";
      entry: JournalEntry;
    }
  | {
      status: "duplicate";
      entry: JournalEntry;
    };

export type DayAggregate = {
  dayKey: string;
  memoCount: number;
  averageHappiness: number | null;
};

export type CalendarCell = {
  dayKey: string;
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  memoCount: number;
  averageHappiness: number | null;
  isToday: boolean;
};

export type TextNoteDraft = {
  title?: string;
  body: string;
};

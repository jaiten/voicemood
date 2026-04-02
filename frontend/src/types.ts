export type ScreenName = "import" | "results" | "detail";

export type MoodLabel = "Low" | "Neutral" | "High";
export type ResultStatus = "success" | "error";

export type PickedAudioFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

export type NoteResult = {
  filename: string;
  status: ResultStatus;
  transcript?: string | null;
  happiness_score?: number | null;
  label?: MoodLabel | null;
  summary?: string | null;
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


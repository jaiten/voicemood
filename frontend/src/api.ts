import { AnalysisResponse, NoteResult, PickedAudioFile } from "./types";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function inferMimeType(filename: string): string {
  const lowerFilename = filename.toLowerCase();
  const extension = Object.keys(AUDIO_MIME_BY_EXTENSION).find((item) => lowerFilename.endsWith(item));
  return extension ? AUDIO_MIME_BY_EXTENSION[extension] : "application/octet-stream";
}

function isAnalysisResponse(payload: unknown): payload is AnalysisResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<AnalysisResponse>;

  return (
    typeof candidate.average_happiness === "number" &&
    typeof candidate.overall_label === "string" &&
    typeof candidate.count === "number" &&
    typeof candidate.successful_count === "number" &&
    typeof candidate.failed_count === "number" &&
    Array.isArray(candidate.results)
  );
}

export async function analyzeVoiceNotes(
  files: PickedAudioFile[],
  onStatusChange?: (status: string) => void,
): Promise<AnalysisResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || inferMimeType(file.name),
    } as any);
  });

  onStatusChange?.("Backend is transcribing, extracting vocal tone, and scoring your notes...");

  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.detail || "The backend could not analyze these files.");
  }

  if (!isAnalysisResponse(payload)) {
    throw new Error("The app received an unexpected response. Check that EXPO_PUBLIC_API_URL points to the FastAPI backend.");
  }

  return payload;
}

export async function analyzeTextNote(
  params: { text: string; title?: string },
  onStatusChange?: (status: string) => void,
): Promise<NoteResult> {
  onStatusChange?.("Analyzing your text note and generating a short summary...");

  const response = await fetch(`${API_URL}/analyze-text`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.detail || "The backend could not analyze this text note.");
  }

  if (!payload || typeof payload !== "object" || typeof payload.filename !== "string") {
    throw new Error("The app received an unexpected text-analysis response from the backend.");
  }

  return payload as NoteResult;
}

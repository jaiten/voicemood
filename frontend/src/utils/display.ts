import { JournalEntry } from "../types";

export function formatFilename(filename?: string | null): string {
  if (!filename) {
    return "Untitled voice note";
  }

  const normalized = filename.replace(/\+/g, " ");

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

export function getEntryDisplayTitle(entry: Pick<JournalEntry, "entryType" | "summary" | "title" | "filename">): string {
  if (entry.summary?.trim()) {
    return entry.summary.trim();
  }

  if (entry.title?.trim()) {
    return entry.title.trim();
  }

  if (entry.filename?.trim()) {
    return formatFilename(entry.filename);
  }

  return entry.entryType === "text" ? "Text note" : "Voice note";
}

export function getEntryDisplaySubtitle(
  entry: Pick<JournalEntry, "summary" | "title" | "filename" | "entryType">,
): string | null {
  if (entry.summary?.trim()) {
    if (entry.title?.trim()) {
      return entry.title.trim();
    }

    if (entry.filename?.trim()) {
      return formatFilename(entry.filename);
    }
  }

  if (entry.entryType !== "text" && entry.filename?.trim()) {
    return formatFilename(entry.filename);
  }

  return null;
}

export function getEntryPreview(entry: Pick<JournalEntry, "entryType" | "textContent" | "transcript">): string {
  if (entry.entryType === "text" && entry.textContent?.trim()) {
    return entry.textContent.trim();
  }

  return entry.transcript?.trim() || entry.textContent?.trim() || "";
}

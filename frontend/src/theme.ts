import { JournalEntryType } from "./types";


export const colors = {
  background: "#f5f1e8",
  backgroundStrong: "#ece4d6",
  surface: "#fffdf8",
  surfaceMuted: "#f0e8dc",
  surfaceMutedSoft: "#f7f3eb",
  text: "#18221e",
  textMuted: "#66726c",
  accent: "#1f5d4a",
  accentSoft: "#dbece4",
  accentSecondary: "#6c7ea1",
  accentSecondarySoft: "#e4e9f4",
  border: "#e2d8ca",
  warning: "#9f4b3f",
  warningSoft: "#f8e2dd",
  info: "#476b93",
  infoSoft: "#e4ecf7",
  neutral: "#8a7445",
  neutralSoft: "#f4e7c9",
  tabBar: "#fffaf1",
};

export const shadows = {
  card: {
    shadowColor: "#19150f",
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 2,
  },
};

export const labelColors = {
  High: {
    background: "#d8eee4",
    text: "#1f5d4a",
  },
  Neutral: {
    background: "#f5ead0",
    text: "#8a7445",
  },
  Low: {
    background: "#f6dfd8",
    text: "#9f4b3f",
  },
};

export const toneColors = {
  Calm: {
    background: "#d8eee4",
    text: "#1f5d4a",
  },
  Animated: {
    background: "#dfe8f7",
    text: "#365f9c",
  },
  Flat: {
    background: "#ece6db",
    text: "#66726c",
  },
  Tense: {
    background: "#f6dfd8",
    text: "#9f4b3f",
  },
  Subdued: {
    background: "#e7ecee",
    text: "#55626b",
  },
};

export const entryTypeColors: Record<JournalEntryType, { background: string; text: string }> = {
  imported_audio: {
    background: "#e5ebf6",
    text: "#4a6696",
  },
  recorded_audio: {
    background: "#dbece4",
    text: "#1f5d4a",
  },
  text: {
    background: "#f4e7c9",
    text: "#8a7445",
  },
};

type LabelTheme = {
  background: string;
  text: string;
};

export function normalizeMoodLabel(value: string | null | undefined): keyof typeof labelColors {
  if (value === "Low" || value === "Neutral" || value === "High") {
    return value;
  }

  return "Neutral";
}

export function getMoodTheme(value: string | null | undefined): LabelTheme {
  return labelColors[normalizeMoodLabel(value)];
}

export function normalizeToneLabel(value: string | null | undefined): keyof typeof toneColors | null {
  if (value === "Calm" || value === "Animated" || value === "Flat" || value === "Tense" || value === "Subdued") {
    return value;
  }

  return null;
}

export function getToneTheme(value: string | null | undefined): LabelTheme {
  const toneLabel = normalizeToneLabel(value);

  if (!toneLabel) {
    return {
      background: colors.surfaceMuted,
      text: colors.textMuted,
    };
  }

  return toneColors[toneLabel];
}

export function getEntryTypeTheme(entryType: JournalEntryType): LabelTheme {
  return entryTypeColors[entryType];
}

export function getSentimentColor(score: number | null): string {
  if (score === null) {
    return "#dfd8cc";
  }

  if (score <= 19) {
    return "#a14a3c";
  }

  if (score <= 39) {
    return "#cf735d";
  }

  if (score <= 59) {
    return "#dec48b";
  }

  if (score <= 79) {
    return "#7cb192";
  }

  return "#1f5d4a";
}

export function getSentimentTextColor(score: number | null): string {
  if (score === null) {
    return colors.textMuted;
  }

  if (score <= 59) {
    return colors.text;
  }

  return "#ffffff";
}

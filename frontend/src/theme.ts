export const colors = {
  background: "#f7f5ef",
  surface: "#ffffff",
  surfaceMuted: "#ece7dd",
  text: "#1f2933",
  textMuted: "#667085",
  accent: "#17624a",
  accentSoft: "#d9efe5",
  border: "#ded7ca",
  warning: "#a03d2f",
  warningSoft: "#f7e1dc",
  neutral: "#866f3d",
  neutralSoft: "#f5ebd6",
};

export const labelColors = {
  High: {
    background: "#d9efe5",
    text: "#17624a",
  },
  Neutral: {
    background: "#f5ebd6",
    text: "#866f3d",
  },
  Low: {
    background: "#f7e1dc",
    text: "#a03d2f",
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

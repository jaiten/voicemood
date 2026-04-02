import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, getMoodTheme, normalizeMoodLabel } from "../theme";
import { NoteResult } from "../types";

type Props = {
  note: NoteResult;
  onBack: () => void;
};

export function NoteDetailScreen({ note, onBack }: Props) {
  const label = normalizeMoodLabel(note.label);
  const labelTheme = getMoodTheme(label);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to results</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <Text style={styles.filename}>{note.filename}</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Score</Text>
            <Text style={styles.metricValue}>{note.happiness_score ?? "--"}</Text>
          </View>

          <View style={[styles.labelPill, { backgroundColor: labelTheme.background }]}>
            <Text style={[styles.labelText, { color: labelTheme.text }]}>{label}</Text>
          </View>
        </View>

        <Text style={styles.summaryLabel}>Summary</Text>
        <Text style={styles.summaryText}>{note.summary || "No summary returned."}</Text>
      </View>

      <View style={styles.transcriptCard}>
        <Text style={styles.transcriptTitle}>Transcript</Text>
        <Text style={styles.transcriptText}>{note.transcript || "No transcript returned."}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    marginTop: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filename: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: colors.text,
  },
  metricRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
  },
  labelPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  labelText: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryLabel: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryText: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  transcriptCard: {
    marginTop: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  transcriptText: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
});

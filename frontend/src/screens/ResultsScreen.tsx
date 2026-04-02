import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, getMoodTheme, normalizeMoodLabel } from "../theme";
import { AnalysisResponse, NoteResult } from "../types";

type Props = {
  analysis: AnalysisResponse;
  onBack: () => void;
  onSelectNote: (note: NoteResult) => void;
};

export function ResultsScreen({ analysis, onBack, onSelectNote }: Props) {
  const overallLabel = normalizeMoodLabel(analysis.overall_label);
  const overallLabelTheme = getMoodTheme(overallLabel);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Overall mood snapshot</Text>
        <Text style={styles.bigScore}>{analysis.average_happiness}</Text>
        <View style={[styles.labelPill, { backgroundColor: overallLabelTheme.background }]}>
          <Text style={[styles.labelText, { color: overallLabelTheme.text }]}>{overallLabel}</Text>
        </View>

        <View style={styles.summaryStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analysis.count}</Text>
            <Text style={styles.statLabel}>Total notes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analysis.successful_count}</Text>
            <Text style={styles.statLabel}>Analyzed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{analysis.failed_count}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This score is a light emotional summary for hobby use, not a medical or clinical assessment.
        </Text>
      </View>

      <Text style={styles.listTitle}>Voice notes</Text>

      {analysis.results.map((note, index) => {
        const isError = note.status === "error";
        const label = normalizeMoodLabel(note.label);
        const labelTheme = getMoodTheme(label);

        return (
          <Pressable
            key={`${note.filename}-${index}`}
            onPress={() => onSelectNote(note)}
            disabled={isError}
            style={[styles.noteCard, isError && styles.noteCardError]}
          >
            <View style={styles.noteHeader}>
              <Text style={styles.filename}>{note.filename}</Text>
              {!isError && (
                <View style={[styles.notePill, { backgroundColor: labelTheme.background }]}>
                  <Text style={[styles.notePillText, { color: labelTheme.text }]}>
                    {note.happiness_score} - {label}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.noteSummary}>{note.summary || "No summary available."}</Text>

            {isError ? (
              <Text style={styles.noteError}>{note.error || "This file failed to analyze."}</Text>
            ) : (
              <Text numberOfLines={3} style={styles.transcriptPreview}>
                {note.transcript || "No transcript returned."}
              </Text>
            )}
          </Pressable>
        );
      })}
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
  summaryCard: {
    marginTop: 16,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  bigScore: {
    marginTop: 16,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: "800",
    color: colors.text,
  },
  labelPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  labelText: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  listTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  noteCard: {
    marginBottom: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteCardError: {
    backgroundColor: colors.warningSoft,
    borderColor: "#efc3b6",
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  filename: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  notePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  notePillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  noteSummary: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  transcriptPreview: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  noteError: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: colors.warning,
    fontWeight: "600",
  },
});

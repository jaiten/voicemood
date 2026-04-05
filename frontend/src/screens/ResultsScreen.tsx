import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { colors, getMoodTheme, getToneTheme, normalizeMoodLabel, normalizeToneLabel } from "../theme";
import { AnalysisResponse, NoteResult } from "../types";
import { formatFilename } from "../utils/display";

type Props = {
  analysis: AnalysisResponse;
  onBack: () => void;
  onSelectNote: (index: number) => void;
};

export function ResultsScreen({ analysis, onBack, onSelectNote }: Props) {
  const overallLabel = normalizeMoodLabel(analysis.overall_label);
  const overallLabelTheme = getMoodTheme(overallLabel);
  const successfulResults = analysis.results.filter((note) => note.status === "success");
  const averageTranscriptScore = averageMetric(successfulResults, "transcript_sentiment_score");
  const averageToneScore = averageMetric(successfulResults, "acoustic_tone_score");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to capture</Text>
      </Pressable>

      <AnimatedCard delay={40} style={styles.summaryCard}>
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
            <Text style={styles.statValue}>{averageTranscriptScore ?? "--"}</Text>
            <Text style={styles.statLabel}>Text avg</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{averageToneScore ?? "--"}</Text>
            <Text style={styles.statLabel}>Tone avg</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Local transcript sentiment and vocal tone are blended into the overall happiness score. This is not medical or
          clinical advice.
        </Text>
      </AnimatedCard>

      <Text style={styles.listTitle}>Latest analysis</Text>

      {analysis.results.map((note, index) => {
        const isError = note.status === "error";
        const overallLabelForNote = normalizeMoodLabel(note.label);
        const overallTheme = getMoodTheme(overallLabelForNote);
        const transcriptLabel = normalizeMoodLabel(note.transcript_label);
        const transcriptTheme = getMoodTheme(transcriptLabel);
        const toneLabel = normalizeToneLabel(note.tone_label);
        const toneTheme = getToneTheme(toneLabel);
        const quickMetrics = buildQuickMetrics(note);

        return (
          <AnimatedCard key={`${note.filename}-${index}`} delay={80 + index * 30} style={[styles.noteCard, isError ? styles.noteCardError : null]}>
            <Pressable onPress={() => onSelectNote(index)} disabled={isError}>
              <View style={styles.noteHeader}>
                <Text style={styles.filename}>{formatFilename(note.filename)}</Text>
                {!isError ? (
                  <View style={[styles.notePill, { backgroundColor: overallTheme.background }]}>
                    <Text style={[styles.notePillText, { color: overallTheme.text }]}>
                      {note.overall_happiness_score} {overallLabelForNote}
                    </Text>
                  </View>
                ) : null}
              </View>

              {!isError ? (
                <View style={styles.metaRow}>
                  <View style={[styles.metaPill, { backgroundColor: transcriptTheme.background }]}>
                    <Text style={[styles.metaPillText, { color: transcriptTheme.text }]}>Text {transcriptLabel}</Text>
                  </View>

                  {toneLabel ? (
                    <View style={[styles.metaPill, { backgroundColor: toneTheme.background }]}>
                      <Text style={[styles.metaPillText, { color: toneTheme.text }]}>Tone {toneLabel}</Text>
                    </View>
                  ) : (
                    <View style={[styles.metaPill, styles.metaPillMuted]}>
                      <Text style={[styles.metaPillText, { color: colors.textMuted }]}>Tone unavailable</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <Text style={styles.noteSummary}>{note.summary || "No summary available."}</Text>

              {isError ? (
                <Text style={styles.noteError}>{note.error || "This file failed to analyze."}</Text>
              ) : (
                <>
                  <Text numberOfLines={3} style={styles.transcriptPreview}>
                    {note.transcript || "No transcript returned."}
                  </Text>
                  {!!quickMetrics && <Text style={styles.metricHint}>{quickMetrics}</Text>}
                </>
              )}
            </Pressable>
          </AnimatedCard>
        );
      })}
    </ScrollView>
  );
}

function averageMetric(results: NoteResult[], key: "transcript_sentiment_score" | "acoustic_tone_score"): number | null {
  const values = results
    .map((note) => note[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function buildQuickMetrics(note: NoteResult): string {
  const features = note.audio_features;
  if (!features) {
    return "";
  }

  const parts: string[] = [];

  if (typeof features.pitch_mean === "number") {
    parts.push(`Pitch ${Math.round(features.pitch_mean)} Hz`);
  }

  if (typeof features.pause_ratio === "number") {
    parts.push(`Pauses ${Math.round(features.pause_ratio * 100)}%`);
  }

  if (typeof features.speaking_rate_estimate === "number") {
    parts.push(`Rate ${features.speaking_rate_estimate.toFixed(1)} w/s`);
  }

  return parts.join("  ");
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
  },
  noteCardError: {
    backgroundColor: colors.warningSoft,
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  metaPillText: {
    fontSize: 12,
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
  metricHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
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

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { EntryTypeBadge } from "../components/EntryTypeBadge";
import { colors, getMoodTheme, getToneTheme } from "../theme";
import { AudioFeatures, JournalEntry } from "../types";
import { formatDateTime } from "../utils/dates";
import { formatFilename, getEntryPreview } from "../utils/display";

type Props = {
  entry: JournalEntry;
  onBack: () => void;
  backLabel?: string;
};

export function NoteDetailScreen({ entry, onBack, backLabel = "Back" }: Props) {
  const overallTheme = getMoodTheme(entry.label);
  const toneTheme = getToneTheme(entry.toneLabel);
  const featureRows = buildFeatureRows(entry.audioFeatures);
  const title =
    entry.title?.trim() ||
    (entry.entryType === "text" ? "Text note" : entry.filename ? formatFilename(entry.filename) : "Voice note");
  const subtitle = entry.title?.trim() && entry.filename ? formatFilename(entry.filename) : null;
  const bodyText = entry.entryType === "text" ? entry.textContent || entry.transcript || "" : entry.transcript || getEntryPreview(entry);
  const createdFromSource = !!entry.sourceCreatedAt || !!entry.sourceModifiedAt;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>{backLabel}</Text>
      </Pressable>

      <AnimatedCard delay={40} style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <EntryTypeBadge entryType={entry.entryType} />
          <Text style={styles.heroMetaText}>{formatDateTime(entry.createdAt)}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Overall happiness</Text>
            <Text style={styles.scoreValue}>{entry.happinessScore}</Text>
          </View>

          <View style={[styles.heroPill, { backgroundColor: overallTheme.background }]}>
            <Text style={[styles.heroPillText, { color: overallTheme.text }]}>{entry.label}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <View style={[styles.infoPill, { backgroundColor: getMoodTheme(entry.label).background }]}>
            <Text style={[styles.infoPillText, { color: getMoodTheme(entry.label).text }]}>
              Text {entry.transcriptSentimentScore ?? "--"}
            </Text>
          </View>

          {entry.toneLabel ? (
            <View style={[styles.infoPill, { backgroundColor: toneTheme.background }]}>
              <Text style={[styles.infoPillText, { color: toneTheme.text }]}>Tone {entry.toneLabel}</Text>
            </View>
          ) : null}
        </View>

        {entry.summary ? (
          <>
            <Text style={styles.sectionLabel}>Summary</Text>
            <Text style={styles.summaryText}>{entry.summary}</Text>
          </>
        ) : null}

        <View style={styles.dateMetaBlock}>
          <Text style={styles.dateMetaText}>Timeline date: {formatDateTime(entry.createdAt)}</Text>
          {createdFromSource ? (
            <Text style={styles.dateMetaText}>Source date preserved from the imported memo when available.</Text>
          ) : null}
          {entry.importedAt && entry.importedAt !== entry.createdAt ? (
            <Text style={styles.dateMetaText}>Imported into VoiceMood: {formatDateTime(entry.importedAt)}</Text>
          ) : null}
        </View>
      </AnimatedCard>

      <AnimatedCard delay={80} style={styles.metricsCard}>
        <Text style={styles.sectionTitle}>Score breakdown</Text>

        <View style={styles.metricsGrid}>
          <MetricTile label="Overall" value={entry.happinessScore} />
          <MetricTile label="Text" value={entry.transcriptSentimentScore} />
          <MetricTile label="Tone" value={entry.acousticToneScore} />
          <MetricTile label="Duration" value={entry.durationSec} suffix="s" />
        </View>
      </AnimatedCard>

      <AnimatedCard delay={120} style={styles.bodyCard}>
        <Text style={styles.sectionTitle}>{entry.entryType === "text" ? "Journal note" : "Transcript"}</Text>
        <Text style={styles.bodyText}>{bodyText || "No text content was saved for this entry."}</Text>
      </AnimatedCard>

      {entry.entryType !== "text" ? (
        <AnimatedCard delay={160} style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Audio features</Text>

          {featureRows.length === 0 ? (
            <Text style={styles.emptyText}>No audio metrics were available for this note.</Text>
          ) : (
            <View style={styles.featureList}>
              {featureRows.map((row) => (
                <View key={row.label} style={styles.featureRow}>
                  <Text style={styles.featureLabel}>{row.label}</Text>
                  <Text style={styles.featureValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

          {entry.filename ? <Text style={styles.filenameHint}>Saved file: {formatFilename(entry.filename)}</Text> : null}
        </AnimatedCard>
      ) : null}
    </ScrollView>
  );
}

type MetricTileProps = {
  label: string;
  value?: number | null;
  suffix?: string;
};

function MetricTile({ label, value, suffix = "" }: MetricTileProps) {
  const displayValue = typeof value === "number" ? `${suffix ? value.toFixed(1) : Math.round(value)}${suffix}` : "--";

  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text style={styles.metricTileValue}>{displayValue}</Text>
    </View>
  );
}

function buildFeatureRows(features?: AudioFeatures | null): Array<{ label: string; value: string }> {
  if (!features) {
    return [];
  }

  const rows: Array<{ label: string; value: string }> = [];
  pushRow(rows, "Duration", formatSeconds(features.duration_seconds));
  pushRow(rows, "Active speech", formatSeconds(features.active_speech_seconds));
  pushRow(rows, "Pitch mean", formatHertz(features.pitch_mean));
  pushRow(rows, "Pitch median", formatHertz(features.pitch_median));
  pushRow(rows, "Pitch variation", formatHertz(features.pitch_std));
  pushRow(rows, "RMS energy", formatDecimal(features.rms_mean, 4));
  pushRow(rows, "Energy variation", formatDecimal(features.rms_std, 4));
  pushRow(rows, "Pause ratio", formatPercent(features.pause_ratio));
  pushRow(rows, "Voiced ratio", formatPercent(features.voiced_ratio));
  pushRow(rows, "Speaking rate", formatRate(features.speaking_rate_estimate));
  pushRow(rows, "Intensity", formatDb(features.intensity_db_mean));
  pushRow(rows, "Spectral centroid", formatHertz(features.spectral_centroid_mean));
  pushRow(rows, "Zero-crossing rate", formatDecimal(features.zero_crossing_rate_mean, 4));
  return rows;
}

function pushRow(rows: Array<{ label: string; value: string }>, label: string, value: string | null) {
  if (!value) {
    return;
  }

  rows.push({ label, value });
}

function formatSeconds(value?: number | null): string | null {
  return typeof value === "number" ? `${value.toFixed(2)} s` : null;
}

function formatHertz(value?: number | null): string | null {
  return typeof value === "number" ? `${value.toFixed(1)} Hz` : null;
}

function formatPercent(value?: number | null): string | null {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : null;
}

function formatDecimal(value?: number | null, digits = 2): string | null {
  return typeof value === "number" ? value.toFixed(digits) : null;
}

function formatRate(value?: number | null): string | null {
  return typeof value === "number" ? `${value.toFixed(2)} words/s` : null;
}

function formatDb(value?: number | null): string | null {
  return typeof value === "number" ? `${value.toFixed(1)} dB` : null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
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
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  heroCard: {
    marginTop: 16,
    padding: 22,
  },
  heroTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  heroMetaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    marginTop: 16,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  scoreRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  scoreCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceMutedSoft,
  },
  scoreLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  scoreValue: {
    marginTop: 6,
    fontSize: 38,
    fontWeight: "800",
    color: colors.text,
  },
  heroPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroPillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  pillRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionLabel: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  summaryText: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  dateMetaBlock: {
    marginTop: 18,
    gap: 4,
  },
  dateMetaText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  metricsCard: {
    marginTop: 16,
    padding: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  metricsGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    width: "47%",
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMutedSoft,
  },
  metricTileLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metricTileValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  bodyCard: {
    marginTop: 16,
    padding: 22,
  },
  bodyText: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  featuresCard: {
    marginTop: 16,
    padding: 22,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  featureList: {
    marginTop: 14,
  },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  featureValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  filenameHint: {
    marginTop: 14,
    fontSize: 13,
    color: colors.textMuted,
  },
});

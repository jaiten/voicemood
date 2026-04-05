import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { EntryTypeBadge } from "../components/EntryTypeBadge";
import { getJournalEntriesByDateRange, getLatestJournalEntries } from "../storage/journalStore";
import { colors, getMoodTheme, getToneTheme } from "../theme";
import { JournalEntry } from "../types";
import { averageScore } from "../utils/aggregation";
import { formatDateTime, formatDayLabel, getDayKey } from "../utils/dates";
import { getEntryDisplaySubtitle, getEntryDisplayTitle, getEntryPreview } from "../utils/display";

type Props = {
  refreshKey: number;
  onSelectEntry: (entry: JournalEntry) => void;
  onOpenCapture: () => void;
  onOpenTimeline: () => void;
};

export function TodayScreen({ refreshKey, onSelectEntry, onOpenCapture, onOpenTimeline }: Props) {
  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadToday = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const todayKey = getDayKey(new Date());
        const [todayResult, latestResult] = await Promise.all([
          getJournalEntriesByDateRange(todayKey, todayKey),
          getLatestJournalEntries(6),
        ]);

        if (!cancelled) {
          setTodayEntries(todayResult);
          setRecentEntries(latestResult);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load today's journal.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadToday();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const todayAverage = useMemo(() => averageScore(todayEntries), [todayEntries]);
  const latestThree = recentEntries.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>Today</Text>
      <Text style={styles.title}>A softer view of today's journal, mood, and voice notes.</Text>
      <Text style={styles.subtitle}>Use this as a quick home screen, then jump into capture or the timeline when you want more detail.</Text>

      <AnimatedCard delay={40} style={styles.heroCard}>
        <Text style={styles.heroLabel}>{formatDayLabel(getDayKey(new Date()))}</Text>
        <Text style={styles.heroScore}>{todayAverage ?? "--"}</Text>
        <Text style={styles.heroCopy}>
          {todayEntries.length === 0
            ? "No entries yet today."
            : `${todayEntries.length} entr${todayEntries.length === 1 ? "y" : "ies"} captured today.`}
        </Text>

        <View style={styles.actionRow}>
          <Pressable onPress={onOpenCapture} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Capture entry</Text>
          </Pressable>

          <Pressable onPress={onOpenTimeline} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open timeline</Text>
          </Pressable>
        </View>
      </AnimatedCard>

      {isLoading ? (
        <AnimatedCard delay={80} style={styles.stateCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.stateText}>Loading today's journal...</Text>
        </AnimatedCard>
      ) : null}

      {!!errorMessage ? (
        <AnimatedCard delay={100} style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AnimatedCard>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's entries</Text>
            {todayEntries.length === 0 ? (
              <AnimatedCard delay={110} style={styles.emptyCard}>
                <Text style={styles.emptyText}>Nothing captured today yet. Record a voice note or write a quick text note.</Text>
              </AnimatedCard>
            ) : (
              todayEntries.map((entry, index) => (
                <TodayEntryCard key={entry.id} entry={entry} delay={120 + index * 30} onPress={() => onSelectEntry(entry)} />
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent across the journal</Text>
            {latestThree.map((entry, index) => (
              <TodayEntryCard key={`recent-${entry.id}`} entry={entry} delay={220 + index * 30} onPress={() => onSelectEntry(entry)} />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function TodayEntryCard({ entry, delay, onPress }: { entry: JournalEntry; delay: number; onPress: () => void }) {
  const moodTheme = getMoodTheme(entry.label);
  const toneTheme = getToneTheme(entry.toneLabel);
  const subtitle = getEntryDisplaySubtitle(entry);
  const preview = getEntryPreview(entry);

  return (
    <AnimatedCard delay={delay} style={styles.entryCardWrap}>
      <Pressable onPress={onPress} style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryTitleBlock}>
            <Text style={styles.entryTitle}>{getEntryDisplayTitle(entry)}</Text>
            {subtitle ? <Text style={styles.entrySubtitle}>{subtitle}</Text> : null}
          </View>

          <View style={[styles.scorePill, { backgroundColor: moodTheme.background }]}>
            <Text style={[styles.scorePillText, { color: moodTheme.text }]}>{entry.happinessScore}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <EntryTypeBadge entryType={entry.entryType} />
          <Text style={styles.timeText}>{formatDateTime(entry.createdAt)}</Text>
          {entry.toneLabel ? (
            <View style={[styles.metaPill, { backgroundColor: toneTheme.background }]}>
              <Text style={[styles.metaPillText, { color: toneTheme.text }]}>Tone {entry.toneLabel}</Text>
            </View>
          ) : null}
        </View>

        {preview ? (
          <Text numberOfLines={2} style={styles.previewText}>
            {preview}
          </Text>
        ) : null}
      </Pressable>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    marginTop: 10,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  heroCard: {
    marginTop: 18,
    padding: 22,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  heroScore: {
    marginTop: 10,
    fontSize: 60,
    lineHeight: 66,
    fontWeight: "800",
    color: colors.text,
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  actionRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryButtonText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  stateCard: {
    marginTop: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  errorCard: {
    marginTop: 16,
    padding: 18,
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: "600",
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emptyCard: {
    padding: 18,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  entryCardWrap: {
    marginBottom: 12,
  },
  entryCard: {
    padding: 18,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  entryTitleBlock: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.text,
  },
  entrySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  scorePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});

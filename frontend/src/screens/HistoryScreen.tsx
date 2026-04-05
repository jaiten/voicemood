import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { EntryTypeBadge } from "../components/EntryTypeBadge";
import { getLatestJournalEntries } from "../storage/journalStore";
import { colors, getMoodTheme, getToneTheme } from "../theme";
import { JournalEntry } from "../types";
import { sortDayKeysDescending } from "../utils/aggregation";
import { formatDateTime, formatHistoryDayLabel } from "../utils/dates";
import { getEntryDisplaySubtitle, getEntryDisplayTitle, getEntryPreview } from "../utils/display";

type Props = {
  refreshKey: number;
  onSelectEntry: (entry: JournalEntry) => void;
};

export function HistoryScreen({ refreshKey, onSelectEntry }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const latestEntries = await getLatestJournalEntries(80);
        if (!cancelled) {
          setEntries(latestEntries);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load local history.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const groups = groupHistoryEntries(entries);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>History</Text>
      <Text style={styles.title}>Recent journal entries, ordered by when they actually happened.</Text>
      <Text style={styles.subtitle}>
        Imported memos use the original file date when it is available, then fall back to modified or import time.
      </Text>

      {isLoading ? (
        <AnimatedCard delay={40} style={styles.stateCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.stateText}>Loading your recent journal entries...</Text>
        </AnimatedCard>
      ) : null}

      {!!errorMessage ? (
        <AnimatedCard delay={60} style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AnimatedCard>
      ) : null}

      {!isLoading && !errorMessage && entries.length === 0 ? (
        <AnimatedCard delay={60} style={styles.stateCard}>
          <Text style={styles.stateText}>Capture a voice or text note first, then it will show up here.</Text>
        </AnimatedCard>
      ) : null}

      {!isLoading &&
        !errorMessage &&
        groups.map((group, groupIndex) => (
          <View key={group.dayKey} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.label}</Text>

            {group.entries.map((entry, entryIndex) => {
              const moodTheme = getMoodTheme(entry.label);
              const toneTheme = getToneTheme(entry.toneLabel);
              const subtitle = getEntryDisplaySubtitle(entry);
              const preview = getEntryPreview(entry);

              return (
                <AnimatedCard
                  key={entry.id}
                  delay={80 + groupIndex * 40 + entryIndex * 30}
                  style={styles.cardWrap}
                >
                  <Pressable onPress={() => onSelectEntry(entry)} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleBlock}>
                        <Text style={styles.cardTitle}>{getEntryDisplayTitle(entry)}</Text>
                        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                      </View>

                      <View style={[styles.scorePill, { backgroundColor: moodTheme.background }]}>
                        <Text style={[styles.scorePillText, { color: moodTheme.text }]}>
                          {entry.happinessScore} {entry.label}
                        </Text>
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
            })}
          </View>
        ))}
    </ScrollView>
  );
}

function groupHistoryEntries(entries: JournalEntry[]) {
  const grouped: Record<string, JournalEntry[]> = {};

  entries.forEach((entry) => {
    if (!grouped[entry.dayKey]) {
      grouped[entry.dayKey] = [];
    }

    grouped[entry.dayKey].push(entry);
  });

  return sortDayKeysDescending(Object.keys(grouped)).map((dayKey) => ({
    dayKey,
    label: formatHistoryDayLabel(dayKey),
    entries: grouped[dayKey],
  }));
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
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  stateCard: {
    marginTop: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  errorCard: {
    marginTop: 18,
    padding: 18,
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
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
  cardWrap: {
    marginBottom: 12,
  },
  card: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
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
    marginTop: 14,
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
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});

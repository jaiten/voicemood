import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedCard } from "../components/AnimatedCard";
import { EntryTypeBadge } from "../components/EntryTypeBadge";
import { SegmentedControl } from "../components/SegmentedControl";
import { getJournalEntriesByDateRange } from "../storage/journalStore";
import { colors, getMoodTheme, getSentimentColor, getSentimentTextColor, getToneTheme } from "../theme";
import { JournalEntry, TimelineMode } from "../types";
import { averageScore, buildCalendarCells, buildDayAggregates, buildWeekCells, filterEntriesForDay } from "../utils/aggregation";
import {
  formatDateTime,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  getDayKey,
  getMonthDateRange,
  getWeekDateRange,
  parseDayKey,
  shiftMonth,
  shiftWeek,
} from "../utils/dates";
import { getEntryDisplaySubtitle, getEntryDisplayTitle, getEntryPreview } from "../utils/display";

type Props = {
  refreshKey: number;
  onSelectEntry: (entry: JournalEntry) => void;
};

const MODES: Array<{ key: TimelineMode; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TimelineScreen({ refreshKey, onSelectEntry }: Props) {
  const [mode, setMode] = useState<TimelineMode>("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState(() => getDayKey(new Date()));
  const [periodEntries, setPeriodEntries] = useState<JournalEntry[]>([]);
  const [selectedWeekEntries, setSelectedWeekEntries] = useState<JournalEntry[]>([]);
  const [isLoadingInitialPeriod, setIsLoadingInitialPeriod] = useState(true);
  const [isRefreshingPeriod, setIsRefreshingPeriod] = useState(false);
  const [isRefreshingWeek, setIsRefreshingWeek] = useState(false);
  const [hasLoadedPeriod, setHasLoadedPeriod] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const periodRange = useMemo(
    () => (mode === "week" ? getWeekDateRange(cursorDate) : getMonthDateRange(cursorDate)),
    [cursorDate, mode],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPeriod = async () => {
      if (!hasLoadedPeriod && periodEntries.length === 0) {
        setIsLoadingInitialPeriod(true);
      } else {
        setIsRefreshingPeriod(true);
      }

      try {
        const entries = await getJournalEntriesByDateRange(periodRange.start, periodRange.end);
        if (cancelled) {
          return;
        }

        setPeriodEntries(entries);
        setSelectedDayKey((currentValue) =>
          isDayKeyInRange(currentValue, periodRange) ? currentValue : getDefaultSelectedDayKey(periodRange, entries),
        );
        setHasLoadedPeriod(true);
        setErrorMessage("");
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load timeline data.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInitialPeriod(false);
          setIsRefreshingPeriod(false);
        }
      }
    };

    loadPeriod();

    return () => {
      cancelled = true;
    };
  }, [periodRange, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    const loadWeek = async () => {
      if (!selectedDayKey) {
        setSelectedWeekEntries([]);
        return;
      }

      setIsRefreshingWeek(true);

      try {
        const range = getWeekDateRange(parseDayKey(selectedDayKey));
        const entries = await getJournalEntriesByDateRange(range.start, range.end);
        if (!cancelled) {
          setSelectedWeekEntries(entries);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load the selected week.";
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsRefreshingWeek(false);
        }
      }
    };

    loadWeek();

    return () => {
      cancelled = true;
    };
  }, [selectedDayKey, refreshKey]);

  const dayAggregates = buildDayAggregates(periodEntries);
  const cells =
    mode === "week"
      ? buildWeekCells(cursorDate, dayAggregates)
      : buildCalendarCells(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1), dayAggregates);
  const selectedDayEntries = filterEntriesForDay(periodEntries, selectedDayKey);
  const periodAverage = averageScore(periodEntries);
  const selectedDayAverage = averageScore(selectedDayEntries);
  const selectedWeekAverage = averageScore(selectedWeekEntries);
  const activeDays = Object.keys(dayAggregates).length;
  const periodLabel = mode === "week" ? formatWeekLabel(cursorDate) : formatMonthLabel(cursorDate);
  const periodAverageLabel = mode === "week" ? "Week average" : "Month average";
  const periodCountLabel = mode === "week" ? "Entries this week" : "Entries this month";
  const selectedWeekLabel = formatWeekLabel(parseDayKey(selectedDayKey));

  const handleChangeMode = (nextMode: TimelineMode) => {
    setMode(nextMode);
    setCursorDate(parseDayKey(selectedDayKey || getDayKey(new Date())));
  };

  const handleShiftPeriod = (direction: -1 | 1) => {
    setCursorDate((currentDate) => (mode === "week" ? shiftWeek(currentDate, direction) : shiftMonth(currentDate, direction)));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>Timeline</Text>
      <Text style={styles.title}>Browse patterns without losing your place as you move through time.</Text>
      <Text style={styles.subtitle}>Switch between week and month views, then tap a day to inspect what was captured there.</Text>

      <AnimatedCard delay={40} style={styles.headerCard}>
        <View style={styles.periodHeader}>
          <Pressable style={styles.periodButton} onPress={() => handleShiftPeriod(-1)}>
            <Text style={styles.periodButtonText}>Prev</Text>
          </Pressable>

          <View style={styles.periodHeaderCenter}>
            <View style={styles.periodTitleRow}>
              <Text style={styles.periodLabel}>{periodLabel}</Text>
              {isRefreshingPeriod ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>
            <Text style={styles.periodHint}>Original memo dates are used when they are available.</Text>
          </View>

          <Pressable style={styles.periodButton} onPress={() => handleShiftPeriod(1)}>
            <Text style={styles.periodButtonText}>Next</Text>
          </Pressable>
        </View>
      </AnimatedCard>

      <View style={styles.segmentWrap}>
        <SegmentedControl items={MODES} activeKey={mode} onChange={handleChangeMode} />
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      {isLoadingInitialPeriod && !hasLoadedPeriod ? (
        <AnimatedCard delay={80} style={styles.stateCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.stateText}>Loading your journal timeline...</Text>
        </AnimatedCard>
      ) : (
        <>
          <AnimatedCard delay={80} style={styles.calendarCard}>
            <View style={styles.grid}>
              {cells.map((cell) => {
                const isSelected = cell.dayKey === selectedDayKey;
                const backgroundColor = cell.inCurrentMonth ? getSentimentColor(cell.averageHappiness) : colors.surfaceMutedSoft;
                const textColor = cell.inCurrentMonth ? getSentimentTextColor(cell.averageHappiness) : colors.textMuted;

                return (
                  <View key={cell.dayKey} style={mode === "week" ? styles.weekCellWrap : styles.monthCellWrap}>
                    <Pressable
                      disabled={mode === "month" && !cell.inCurrentMonth}
                      onPress={() => setSelectedDayKey(cell.dayKey)}
                      style={[
                        styles.dayCell,
                        { backgroundColor, borderColor: isSelected ? colors.accent : colors.border },
                        !cell.inCurrentMonth && mode === "month" ? styles.dayCellMuted : null,
                        isSelected ? styles.dayCellSelected : null,
                      ]}
                    >
                      <Text style={[styles.dayNumber, { color: textColor }]}>{cell.dayNumber}</Text>

                      {cell.memoCount > 0 ? (
                        <View style={styles.dayCountBadge}>
                          <Text style={styles.dayCountText}>{cell.memoCount}</Text>
                        </View>
                      ) : (
                        <View style={styles.emptyDot} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          <AnimatedCard delay={100} style={styles.statsCard}>
            <View style={styles.statsRow}>
              <SummaryStat label={periodAverageLabel} value={periodAverage} />
              <SummaryStat label={periodCountLabel} value={periodEntries.length} />
              <SummaryStat label="Active days" value={activeDays} />
            </View>
          </AnimatedCard>

          <AnimatedCard delay={120} style={styles.dayDetailCard}>
            <View style={styles.dayHeaderRow}>
              <View style={styles.dayHeaderCopy}>
                <Text style={styles.sectionTitle}>{formatDayLabel(selectedDayKey)}</Text>
                <Text style={styles.sectionSubtitle}>Selected week: {selectedWeekLabel}</Text>
              </View>
              {isRefreshingWeek ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>

            <View style={styles.statsRow}>
              <SummaryStat label="Day average" value={selectedDayAverage} />
              <SummaryStat label="Entries that day" value={selectedDayEntries.length} />
              <SummaryStat label="Week average" value={selectedWeekAverage} />
              <SummaryStat label="Week entries" value={selectedWeekEntries.length} />
            </View>

            {!!errorMessage ? (
              <View style={styles.inlineErrorCard}>
                <Text style={styles.inlineErrorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {selectedDayEntries.length === 0 ? (
              <Text style={styles.emptyText}>No entries were saved for this day.</Text>
            ) : (
              <View style={styles.entryList}>
                {selectedDayEntries.map((entry) => {
                  const moodTheme = getMoodTheme(entry.label);
                  const toneTheme = getToneTheme(entry.toneLabel);
                  const subtitle = getEntryDisplaySubtitle(entry);
                  const preview = getEntryPreview(entry);

                  return (
                    <Pressable key={entry.id} onPress={() => onSelectEntry(entry)} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View style={styles.entryTitleBlock}>
                          <Text style={styles.entryTitle}>{getEntryDisplayTitle(entry)}</Text>
                          {subtitle ? <Text style={styles.entrySubtitle}>{subtitle}</Text> : null}
                        </View>

                        <View style={[styles.scorePill, { backgroundColor: moodTheme.background }]}>
                          <Text style={[styles.scorePillText, { color: moodTheme.text }]}>
                            {entry.happinessScore} {entry.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.entryMetaRow}>
                        <EntryTypeBadge entryType={entry.entryType} />
                        <Text style={styles.entryMetaText}>{formatDateTime(entry.createdAt)}</Text>
                        {entry.toneLabel ? (
                          <View style={[styles.metaPill, { backgroundColor: toneTheme.background }]}>
                            <Text style={[styles.metaPillText, { color: toneTheme.text }]}>Tone {entry.toneLabel}</Text>
                          </View>
                        ) : null}
                      </View>

                      {preview ? (
                        <Text numberOfLines={2} style={styles.entryPreview}>
                          {preview}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </AnimatedCard>
        </>
      )}
    </ScrollView>
  );
}

type SummaryStatProps = {
  label: string;
  value: number | string | null;
};

function SummaryStat({ label, value }: SummaryStatProps) {
  const displayValue = typeof value === "number" ? `${value}` : value ?? "--";

  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{displayValue}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function isDayKeyInRange(dayKey: string, range: { start: string; end: string }) {
  return dayKey >= range.start && dayKey <= range.end;
}

function getDefaultSelectedDayKey(range: { start: string; end: string }, entries: JournalEntry[]) {
  const todayKey = getDayKey(new Date());
  if (isDayKeyInRange(todayKey, range)) {
    return todayKey;
  }

  return entries[0]?.dayKey ?? range.start;
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
  headerCard: {
    marginTop: 18,
    padding: 20,
  },
  periodHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  periodHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },
  periodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  periodHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  periodButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  segmentWrap: {
    marginTop: 16,
  },
  weekdayRow: {
    marginTop: 14,
    flexDirection: "row",
  },
  weekdayText: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
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
    lineHeight: 21,
    color: colors.textMuted,
  },
  calendarCard: {
    marginTop: 10,
    padding: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthCellWrap: {
    width: "14.2857%",
    padding: 3,
  },
  weekCellWrap: {
    width: "14.2857%",
    padding: 4,
  },
  dayCell: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  dayCellMuted: {
    opacity: 0.42,
  },
  dayCellSelected: {
    shadowColor: colors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 1,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  dayCountBadge: {
    alignSelf: "flex-start",
    minWidth: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  dayCountText: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: colors.text,
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(24,34,30,0.18)",
  },
  statsCard: {
    marginTop: 14,
    padding: 18,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceMutedSoft,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  dayDetailCard: {
    marginTop: 14,
    padding: 20,
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  dayHeaderCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  inlineErrorCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.warningSoft,
  },
  inlineErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  entryList: {
    marginTop: 16,
    gap: 12,
  },
  entryCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.surfaceMutedSoft,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
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
  entryMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  entryMetaText: {
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
  entryPreview: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});

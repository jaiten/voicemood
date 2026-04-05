import { CalendarCell, DayAggregate, JournalEntry } from "../types";
import { getDayKey, getStartOfWeek, parseDayKey } from "./dates";


export function averageScore(entries: Array<{ happinessScore: number }>): number | null {
  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, entry) => sum + entry.happinessScore, 0);
  return Math.round(total / entries.length);
}

export function groupByDay(entries: JournalEntry[]): Record<string, JournalEntry[]> {
  return entries.reduce<Record<string, JournalEntry[]>>((groups, entry) => {
    if (!groups[entry.dayKey]) {
      groups[entry.dayKey] = [];
    }

    groups[entry.dayKey].push(entry);
    return groups;
  }, {});
}

export function buildDayAggregates(entries: JournalEntry[]): Record<string, DayAggregate> {
  const grouped = groupByDay(entries);
  const aggregates: Record<string, DayAggregate> = {};

  Object.entries(grouped).forEach(([dayKey, dayEntries]) => {
    aggregates[dayKey] = {
      dayKey,
      memoCount: dayEntries.length,
      averageHappiness: averageScore(dayEntries),
    };
  });

  return aggregates;
}

export function buildCalendarCells(month: Date, dayMap: Record<string, DayAggregate>): CalendarCell[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dayKey = getDayKey(date);
    const aggregate = dayMap[dayKey];

    return {
      dayKey,
      date,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month.getMonth(),
      memoCount: aggregate?.memoCount ?? 0,
      averageHappiness: aggregate?.averageHappiness ?? null,
      isToday: dayKey === getDayKey(new Date()),
    };
  });
}

export function buildWeekCells(weekBaseDate: Date, dayMap: Record<string, DayAggregate>): CalendarCell[] {
  const weekStart = getStartOfWeek(weekBaseDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    const dayKey = getDayKey(date);
    const aggregate = dayMap[dayKey];

    return {
      dayKey,
      date,
      dayNumber: date.getDate(),
      inCurrentMonth: true,
      memoCount: aggregate?.memoCount ?? 0,
      averageHappiness: aggregate?.averageHappiness ?? null,
      isToday: dayKey === getDayKey(new Date()),
    };
  });
}

export function filterEntriesForDay(entries: JournalEntry[], dayKey: string): JournalEntry[] {
  return entries.filter((entry) => entry.dayKey === dayKey);
}

export function sortDayKeysDescending(dayKeys: string[]): string[] {
  return [...dayKeys].sort((a, b) => parseDayKey(b).getTime() - parseDayKey(a).getTime());
}

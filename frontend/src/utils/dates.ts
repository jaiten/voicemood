export function getDayKey(date: string | Date): string {
  const localDate = typeof date === "string" ? new Date(date) : new Date(date);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCanonicalEntryDate(params: {
  sourceCreatedAt?: string | null;
  sourceModifiedAt?: string | null;
  importedAt: string;
}): string {
  return params.sourceCreatedAt || params.sourceModifiedAt || params.importedAt;
}

export function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekLabel(date: Date): string {
  const range = getWeekDateRange(date);
  const startDate = parseDayKey(range.start);
  const endDate = parseDayKey(range.end);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDayLabel(dayKey: string): string {
  const date = parseDayKey(dayKey);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatHistoryDayLabel(dayKey: string): string {
  const todayKey = getDayKey(new Date());
  if (dayKey === todayKey) {
    return "Today";
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === getDayKey(yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(parseDayKey(dayKey));
}

export function getMonthDateRange(baseDate: Date): { start: string; end: string } {
  const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

  return {
    start: getDayKey(startDate),
    end: getDayKey(endDate),
  };
}

export function getWeekDateRange(baseDate: Date): { start: string; end: string } {
  const startDate = getStartOfWeek(baseDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    start: getDayKey(startDate),
    end: getDayKey(endDate),
  };
}

export function getStartOfWeek(baseDate: Date): Date {
  const startDate = new Date(baseDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  return startDate;
}

export function shiftMonth(baseDate: Date, amount: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + amount, 1);
}

export function shiftWeek(baseDate: Date, amount: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + amount * 7);
  return nextDate;
}

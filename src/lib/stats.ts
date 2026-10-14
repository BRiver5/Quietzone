import { addDays, dayNumber, weekStart } from "./time.ts";

// Статистика выводится из журналов (экспорты, тесты сканирования), ничего не хранит.

export type ExportLog = { codeId: string; date: string; kind: "print" | "share" };
export type TestLog = { profileId: string; date: string; ok: boolean; ratio: number };

export function weekly<T extends { date: string }>(rows: T[], today: string, weeks = 8): { start: string; count: number }[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({ start: addDays(first, 7 * i), count: 0 }));
  for (const r of rows) {
    const i = Math.floor((dayNumber(r.date) - dayNumber(first)) / 7);
    if (i >= 0 && i < weeks) out[i].count++;
  }
  return out;
}

export function activityHeat(dates: string[], today: string, weeks = 12): { date: string; count: number }[] {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const by = new Map<string, number>();
  for (const d of dates) by.set(d, (by.get(d) ?? 0) + 1);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, count: dayNumber(d) > dayNumber(today) ? -1 : by.get(d) ?? 0 };
  });
}

// Доля успешных тестов с интервалом Уилсона — честно говорит, когда тестов мало.
export function wilson(ok: number, n: number, z = 1.645): { p: number; lo: number; hi: number } | null {
  if (n === 0) return null;
  const p = ok / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, lo: (c - m) / d, hi: (c + m) / d };
}

export function countBy<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

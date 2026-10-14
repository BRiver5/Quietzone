// Календарная арифметика строго в UTC: даты хранятся строками "YYYY-MM-DD",
// месяцы — "YYYY-MM". Локальные геттеры Date здесь не используются вообще —
// иначе на границе суток/часового пояса списание "уезжает" на соседний день.

const MS_DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

export function fromDayNumber(n: number): string {
  return new Date(n * MS_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function monthFromIndex(index: number): string {
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function addMonthsKey(key: string, n: number): string {
  return monthFromIndex(monthIndex(key) + n);
}

export function firstOfMonth(key: string): string {
  return `${key}-01`;
}

export function monthLabel(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}

export function monthLabelLong(key: string): string {
  return `${monthLabel(key)} ${key.slice(0, 4)}`;
}

export function dayLabel(iso: string): string {
  return `${monthLabel(iso.slice(0, 7))} ${Number(iso.slice(8, 10))}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function weekdayLabel(iso: string): string {
  return WEEKDAYS[new Date(dayNumber(iso) * MS_DAY).getUTCDay()];
}

// Понедельник недели, в которую попадает дата.
export function weekStart(iso: string): string {
  const n = dayNumber(iso);
  const dow = new Date(n * MS_DAY).getUTCDay();
  return fromDayNumber(n - ((dow + 6) % 7));
}

// Доля текущего месяца, которая ещё впереди (включая сегодняшний день).
export function monthRemainingFraction(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dim = daysInMonth(y, m);
  return (dim - d + 1) / dim;
}

// "Сегодня" по локальному календарю пользователя, но в виде UTC-строки —
// единственное место, где читается локальное время.
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Палитра Quietzone — "технический чертёж": белая бумага с сеткой, тушь,
// один морской тил. Единственный файл с цветовыми значениями.
//
// Акцент #0E8181 — количественный перебор сетки HSL (сектор 140–230°, пустой
// среди последних десяти приложений реестра) с максимизацией минимальной
// Lab-дистанции до всех акцентов DESIGN_REGISTRY.md. Белый на акценте 4.69:1 (посчитано, AA).
// Сами QR-коды по умолчанию чёрные на белом — цвет приложения живёт в хроме,
// а не в кодах (контраст кода — вопрос читаемости, не бренда).
// Статусы проверок — отдельная тройка, не завязана на акцент.
// Тема светлая без тёмного варианта (осознанно, переключателя нет).

export const light = {
  background: "#F5F6F3",
  backgroundAlt: "#EAECE7",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F1",
  border: "#DDE1DB",
  grid: "#E6E9E3",
  ink: "#101A1A",
  inkMuted: "#526160",
  inkFaint: "#93A09F",
  onAccent: "#FFFFFF",
  accent: "#0E8181",
  accentSoft: "#DCEFEC",
  accentDeep: "#095E5E",
  signal: "#C98207",
  signalSoft: "#FBEFD9",
  danger: "#C43A31",
  dangerSoft: "#F8E1DE",
  success: "#2F8F4E",
  successSoft: "#E0F1E5",
  scrim: "rgba(16,26,26,0.45)",
};

export const dark = light;
export type Palette = typeof light;

export type StatusKey = "ok" | "warn" | "fail";
export const statusColor: Record<StatusKey, string> = { ok: light.success, warn: light.signal, fail: light.danger };
export const statusSoft: Record<StatusKey, string> = { ok: light.successSoft, warn: light.signalSoft, fail: light.dangerSoft };

// Категориальная шкала — документированный набор dataviz-скилла, проверенный
// validate_palette.js в этом фиксированном порядке (ALL CHECKS PASS). Красит
// типы содержимого (донат статистики) и блоки коррекции на карте анатомии.
// Ниже 3:1 к поверхности — поэтому рядом всегда текстовая подпись.
export const seriesColors = ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#6250D6"];

export const contentColors = {
  url: seriesColors[0],
  text: seriesColors[1],
  wifi: seriesColors[2],
  contact: seriesColors[3],
  email: seriesColors[4],
  phone: seriesColors[5],
  sms: seriesColors[6],
} as const;

// Цвета узоров на карте анатомии — смысловые, не категориальные.
export const kindColors = {
  finder: "#101A1A",
  separator: "#FFFFFF",
  timing: "#0E8181",
  alignment: "#095E5E",
  format: "#C98207",
  version: "#C43A31",
  dark: "#101A1A",
  remainder: "#C9CFC8",
};

// Пресеты цветов кода: тушь/бумага с хорошим контрастом + пара заведомо
// спорных, чтобы проверка контраста была видна в деле.
export const COLOR_PRESETS: { fg: string; bg: string; label: string }[] = [
  { fg: "#000000", bg: "#FFFFFF", label: "Ink" },
  { fg: "#0A4747", bg: "#FFFFFF", label: "Teal" },
  { fg: "#1E2A78", bg: "#FFFDF5", label: "Navy" },
  { fg: "#5B1F14", bg: "#FFF8EE", label: "Rust" },
  { fg: "#7A8B8A", bg: "#FFFFFF", label: "Fog" },
  { fg: "#FFFFFF", bg: "#101A1A", label: "Inverted" },
];

export function heatColor(t: number): string {
  if (t < 0) return "transparent";
  if (t === 0) return light.backgroundAlt;
  const stops = ["#C3E3DF", "#7DC2BB", "#3A9C96", "#0E8181"];
  return stops[Math.min(stops.length - 1, Math.floor(t * stops.length - 1e-9))];
}

// Физика печати: размер модуля, контраст, тихая зона, дальность.
// Ориентир дальности по умолчанию — известное правило "расстояние ≈ 10 ширин
// кода", переведённое в мм модуля на 10 см расстояния; реальный порог для
// конкретного принтера/материала учит профиль (profile.ts).

export const DEFAULT_RATIO = 0.3; // мм модуля на каждые 10 см расстояния

export function moduleMm(printMm: number, size: number, quiet: number): number {
  return printMm / (size + 2 * quiet);
}

export function minPrintMm(size: number, quiet: number, distanceCm: number, ratio: number): number {
  return ratio * (distanceCm / 10) * (size + 2 * quiet);
}

export function maxDistanceCm(printMm: number, size: number, quiet: number, ratio: number): number {
  return (moduleMm(printMm, size, quiet) / ratio) * 10;
}

// Относительная яркость по WCAG и контраст пары цветов.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

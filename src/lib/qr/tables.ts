// Таблицы стандарта ISO/IEC 18004 для версий 1–40.

export type Ecl = "L" | "M" | "Q" | "H";
export const ECL_ORDER: Ecl[] = ["L", "M", "Q", "H"];
export const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };
export const ECL_RECOVERY: Record<Ecl, string> = { L: "~7%", M: "~15%", Q: "~25%", H: "~30%" };

// Кодовых слов коррекции на блок (индекс — версия, 0 не используется).
const ECC_PER_BLOCK: Record<Ecl, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

// Число блоков коррекции.
const NUM_BLOCKS: Record<Ecl, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// "Защита от ложного декодирования": в малых версиях часть кодовых слов
// коррекции зарезервирована и НЕ идёт на исправление ошибок (таблица 9 стандарта).
const MISDECODE: Record<string, number> = { "1L": 3, "1M": 2, "1Q": 1, "1H": 1, "2L": 2, "3L": 1 };

export function eccPerBlock(ver: number, ecl: Ecl): number {
  return ECC_PER_BLOCK[ecl][ver];
}

export function numBlocks(ver: number, ecl: Ecl): number {
  return NUM_BLOCKS[ecl][ver];
}

// Сколько ошибочных кодовых слов блок исправит (позиции неизвестны).
export function correctablePerBlock(ver: number, ecl: Ecl): number {
  return Math.floor((eccPerBlock(ver, ecl) - (MISDECODE[`${ver}${ecl}`] ?? 0)) / 2);
}

export function symbolSize(ver: number): number {
  return ver * 4 + 17;
}

// Модулей под данные+коррекцию (всё, кроме функциональных узоров).
export function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

export function numDataCodewords(ver: number, ecl: Ecl): number {
  return Math.floor(numRawDataModules(ver) / 8) - eccPerBlock(ver, ecl) * numBlocks(ver, ecl);
}

export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = symbolSize(ver) - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

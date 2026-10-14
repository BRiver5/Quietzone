import { correctablePerBlock } from "./qr/tables.ts";
import type { ModuleKind, QrCode } from "./qr/encode.ts";

// Прочитается ли код с логотипом в центре. Не правило "логотип ≤ 30%",
// а подсчёт по карте модулей: какие модули закрыты, каким кодовым словам
// они принадлежат, в каких блоках эти слова лежат — и хватит ли коррекции
// КАЖДОГО блока. Блок с перебором ломает весь код, даже если "в среднем" запас есть.
// Логотип — квадрат по центру, + 1 модуль поля вокруг (рамка тоже закрывает модули).
// Запас: логотип не должен съедать больше 60% исправимого в блоке — остальное
// нужно на печать, блики и размытие камеры.

export const LOGO_BUDGET = 0.6;

export type BlockLoad = { block: number; hit: number; capacity: number; ratio: number };

export type DamageReport = {
  logoModules: number; // сторона логотипа в модулях (с полем)
  blocks: BlockLoad[];
  worst: BlockLoad | null;
  criticalHits: { kind: ModuleKind; count: number }[]; // закрытые функциональные узоры
  status: "clean" | "safe" | "risky" | "broken";
};

const CRITICAL: ModuleKind[] = ["finder", "separator", "timing", "format", "version", "dark"];

export function logoSide(qr: QrCode, frac: number): number {
  if (frac <= 0) return 0;
  // Нечётная сторона, чтобы логотип стоял ровно по центру сетки.
  let side = Math.round(qr.size * frac) + 2;
  if ((side - qr.size) % 2 !== 0) side++;
  return Math.min(qr.size, side);
}

export function damageFor(qr: QrCode, frac: number): DamageReport {
  const side = logoSide(qr, frac);
  const cap = correctablePerBlock(qr.version, qr.ecl);
  const hitWords = new Set<number>();
  const critical = new Map<ModuleKind, number>();
  if (side > 0) {
    const start = Math.floor((qr.size - side) / 2);
    for (let y = start; y < start + side; y++)
      for (let x = start; x < start + side; x++) {
        const k = qr.kind[y][x];
        if (CRITICAL.includes(k)) critical.set(k, (critical.get(k) ?? 0) + 1);
        const cw = qr.codewordAt[y * qr.size + x];
        if (cw >= 0) hitWords.add(cw);
      }
  }
  const perBlock = qr.blocks.map(() => 0);
  for (const cw of hitWords) perBlock[qr.blockOf[cw]]++;
  const blocks = perBlock.map((hit, block) => ({ block, hit, capacity: cap, ratio: cap > 0 ? hit / cap : hit > 0 ? Infinity : 0 }));
  const worst = blocks.length ? blocks.reduce((a, b) => (b.ratio > a.ratio ? b : a)) : null;
  const criticalHits = [...critical.entries()].map(([kind, count]) => ({ kind, count }));
  let status: DamageReport["status"] = "clean";
  if (side > 0) {
    if (criticalHits.length || (worst && worst.ratio > 1)) status = "broken";
    else if (worst && worst.ratio > LOGO_BUDGET) status = "risky";
    else status = "safe";
  }
  return { logoModules: side, blocks, worst, criticalHits, status };
}

// Самый большой логотип, который укладывается в бюджет. Больший квадрат
// закрывает надмножество модулей, поэтому нагрузка монотонна — идём шагом 1%
// (сторона в модулях всё равно дискретна) до первого превышения.
export function maxSafeLogo(qr: QrCode, budget = LOGO_BUDGET, limit = 0.45): number {
  let best = 0;
  for (let p = 1; p <= Math.round(limit * 100); p++) {
    const f = p / 100;
    const d = damageFor(qr, f);
    if (d.criticalHits.length || (d.worst && d.worst.ratio > budget)) break;
    best = f;
  }
  return best;
}

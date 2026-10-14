import { DEFAULT_RATIO } from "./print.ts";

// Профиль печати учится на ваших тестах сканирования. Неизвестный параметр —
// порог θ: минимальный размер модуля (мм на 10 см расстояния), при котором
// код с этого принтера/материала уверенно читается. Распределение θ хранится
// сеткой (байесовский гистограммный апостериор) и ДОМНОЖАЕТСЯ на правдоподобие
// каждого нового теста — состояние накапливается, а не пересчитывается.
// Тест "прочитался" при r = модуль/дистанция: вероятность успеха растёт
// логистически по ln(r/θ); есть пол и потолок (камера иногда промахивается
// на хорошем коде и иногда угадывает плохой).

export const GRID_MIN = 0.06;
export const GRID_MAX = 1.5;
export const GRID_N = 64;
const SLOPE = 0.18; // ширина перехода в логарифме
const FLOOR = 0.04;
const CEIL = 0.96;

export function gridValue(i: number): number {
  return GRID_MIN * Math.pow(GRID_MAX / GRID_MIN, i / (GRID_N - 1));
}

// Априор: логнормаль вокруг правила "10 ширин кода", широкая (σ = 0.6 в ln).
export function priorPosterior(center = DEFAULT_RATIO, sigma = 0.6): number[] {
  const w = Array.from({ length: GRID_N }, (_, i) => {
    const z = Math.log(gridValue(i) / center) / sigma;
    return Math.exp(-0.5 * z * z);
  });
  return normalize(w);
}

function normalize(w: number[]): number[] {
  const s = w.reduce((a, b) => a + b, 0);
  return s > 0 ? w.map((v) => v / s) : w.map(() => 1 / w.length);
}

export function successProb(ratio: number, theta: number): number {
  const p = 1 / (1 + Math.exp(-Math.log(ratio / theta) / SLOPE));
  return FLOOR + (CEIL - FLOOR) * p;
}

export type ScanTest = { moduleMm: number; distanceCm: number; ok: boolean };

export function testRatio(t: ScanTest): number {
  return t.moduleMm / (t.distanceCm / 10);
}

// Одно наблюдение — одно обновление.
export function update(post: number[], t: ScanTest): number[] {
  const r = testRatio(t);
  return normalize(post.map((p, i) => {
    const s = successProb(r, gridValue(i));
    return p * (t.ok ? s : 1 - s);
  }));
}

export function quantile(post: number[], q: number): number {
  let acc = 0;
  for (let i = 0; i < post.length; i++) {
    acc += post[i];
    if (acc >= q) return gridValue(i);
  }
  return gridValue(post.length - 1);
}

export type ProfileSummary = {
  recommended: number; // 90-й перцентиль θ — с запасом
  median: number;
  lo: number; // 10%
  hi: number; // 90%
  confidence: "prior" | "rough" | "solid";
};

export function summarize(post: number[], tests: number): ProfileSummary {
  const lo = quantile(post, 0.1);
  const hi = quantile(post, 0.9);
  const spread = Math.log(hi / lo);
  return {
    recommended: hi,
    median: quantile(post, 0.5),
    lo,
    hi,
    confidence: tests === 0 ? "prior" : spread < 0.7 ? "solid" : "rough",
  };
}

// Какой тест сейчас информативнее всего: проверить у медианы — там модель
// меньше всего знает, прочитается ли код (вероятность ближе всего к 50/50).
export function suggestTest(post: number[], moduleMmValue: number): { distanceCm: number } {
  const median = quantile(post, 0.5);
  return { distanceCm: Math.max(10, Math.round((moduleMmValue / median) * 10)) };
}

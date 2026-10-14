// Разбивка текста на сегменты режимов (Numeric / Alphanumeric / Byte) с
// МИНИМАЛЬНОЙ длиной потока бит — точное ДП по символам, а не "весь текст
// одним режимом". Цена в шестых долях бита: цифра 10/3 бит = 20, буквенно-
// цифровой символ 11/2 = 33, байт UTF-8 8 бит = 48; смена режима стоит
// заголовок (4 бита режима + длина счётчика, зависящая от класса версии).

export type Mode = "numeric" | "alnum" | "byte";
export const MODES: Mode[] = ["byte", "alnum", "numeric"];

export const ALNUM_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const MODE_BITS: Record<Mode, number> = { numeric: 0x1, alnum: 0x2, byte: 0x4 };
const COUNT_BITS: Record<Mode, [number, number, number]> = {
  numeric: [10, 12, 14],
  alnum: [9, 11, 13],
  byte: [8, 16, 16],
};

export function versionClass(ver: number): 0 | 1 | 2 {
  return ver <= 9 ? 0 : ver <= 26 ? 1 : 2;
}

export function countBits(mode: Mode, ver: number): number {
  return COUNT_BITS[mode][versionClass(ver)];
}

export function modeIndicator(mode: Mode): number {
  return MODE_BITS[mode];
}

const isNumeric = (c: string) => c >= "0" && c <= "9";
const isAlnum = (c: string) => ALNUM_CHARSET.includes(c);

export function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

export type Segment = { mode: Mode; text: string; bits: number };

// Длина сегмента в битах без заголовка.
export function payloadBits(mode: Mode, text: string): number {
  const n = [...text].length;
  if (mode === "numeric") return Math.floor(n / 3) * 10 + [0, 4, 7][n % 3];
  if (mode === "alnum") return Math.floor(n / 2) * 11 + (n % 2) * 6;
  return utf8Bytes(text).length * 8;
}

export function segmentBits(seg: { mode: Mode; text: string }, ver: number): number {
  return 4 + countBits(seg.mode, ver) + payloadBits(seg.mode, seg.text);
}

export function totalBits(segs: { mode: Mode; text: string }[], ver: number): number {
  return segs.reduce((s, x) => s + segmentBits(x, ver), 0);
}

// Оптимальная разбивка для данного класса версии.
export function optimalSegments(text: string, ver: number): Segment[] {
  const chars = [...text];
  if (!chars.length) return [];
  const n = MODES.length;
  const head = MODES.map((m) => (4 + countBits(m, ver)) * 6);
  let prev = head.slice();
  const choices: (Mode | null)[][] = [];
  for (const c of chars) {
    const cur = new Array<number>(n).fill(Infinity);
    const ch: (Mode | null)[] = new Array(n).fill(null);
    // Продолжить текущий сегмент тем же режимом.
    cur[0] = prev[0] + utf8Bytes(c).length * 48;
    ch[0] = "byte";
    if (isAlnum(c)) {
      cur[1] = prev[1] + 33;
      ch[1] = "alnum";
    }
    if (isNumeric(c)) {
      cur[2] = prev[2] + 20;
      ch[2] = "numeric";
    }
    // Закрыть сегмент режима k на этом символе и открыть режим j.
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        if (ch[k] === null || cur[k] === Infinity) continue;
        const cost = Math.ceil(cur[k] / 6) * 6 + head[j];
        if (ch[j] === null || cost < cur[j]) {
          cur[j] = cost;
          ch[j] = MODES[k];
        }
      }
    }
    choices.push(ch);
    prev = cur;
  }
  // Обратный проход: режим, которым реально закодирован каждый символ.
  let best = 0;
  for (let j = 1; j < n; j++) if (prev[j] < prev[best]) best = j;
  let curMode: Mode = MODES[best];
  const perChar: Mode[] = new Array(chars.length);
  for (let i = chars.length - 1; i >= 0; i--) {
    const j = MODES.indexOf(curMode);
    curMode = choices[i][j] as Mode;
    perChar[i] = curMode;
  }
  const segs: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || perChar[i] !== perChar[start]) {
      const t = chars.slice(start, i).join("");
      segs.push({ mode: perChar[start], text: t, bits: segmentBits({ mode: perChar[start], text: t }, ver) });
      start = i;
    }
  }
  return segs;
}

// Сегменты "одним режимом" — для сравнения на экране анатомии.
export function singleModeSegments(text: string, ver: number): Segment[] {
  const chars = [...text];
  const mode: Mode = chars.every(isNumeric) ? "numeric" : chars.every(isAlnum) ? "alnum" : "byte";
  return text ? [{ mode, text, bits: segmentBits({ mode, text }, ver) }] : [];
}

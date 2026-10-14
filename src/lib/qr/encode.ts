import { rsDivisor, rsRemainder } from "./gf.ts";
import { modeIndicator, countBits, optimalSegments, utf8Bytes, ALNUM_CHARSET, totalBits, type Segment } from "./segments.ts";
import { alignmentPositions, ECL_FORMAT_BITS, eccPerBlock, numBlocks, numDataCodewords, numRawDataModules, symbolSize, type Ecl } from "./tables.ts";

// Полный кодер QR: сегменты → поток бит → кодовые слова данных → блоки
// Рида — Соломона → чередование → матрица → лучшая из 8 масок.
// Вместе с матрицей возвращается КАРТА: для каждого модуля — какой это
// функциональный узор или какое кодовое слово и какой блок он несёт.
// На этой карте стоит анализ "прочитается ли код с логотипом" (damage.ts).

export type ModuleKind = "data" | "finder" | "separator" | "timing" | "alignment" | "format" | "version" | "dark" | "remainder";

export type Penalty = { runs: number; boxes: number; finderLike: number; balance: number; total: number };

export type QrCode = {
  version: number;
  ecl: Ecl;
  size: number;
  mask: number;
  modules: boolean[][]; // [y][x], true = тёмный
  kind: ModuleKind[][];
  codewordAt: Int16Array; // y*size+x → индекс кодового слова в итоговой (чередованной) последовательности, −1 нет
  blockOf: number[]; // индекс кодового слова → номер блока
  isEccWord: boolean[]; // индекс кодового слова → это слово коррекции
  blocks: { data: number; ecc: number }[];
  segments: Segment[];
  dataBits: number; // полезных бит (без заполнителей)
  capacityBits: number;
  penalties: Penalty[]; // по всем 8 маскам
  codewords: number[];
};

export class CapacityError extends Error {}

// Минимальная версия, в которую входит текст на данном уровне коррекции.
export function chooseVersion(text: string, ecl: Ecl, minVersion = 1): { version: number; segments: Segment[]; bits: number } {
  for (let v = Math.max(1, minVersion); v <= 40; v++) {
    const segments = optimalSegments(text, v);
    const bits = totalBits(segments, v);
    if (bits <= numDataCodewords(v, ecl) * 8) return { version: v, segments, bits };
  }
  throw new CapacityError("Too much content for any QR version at this error-correction level.");
}

function appendBits(buf: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) buf.push((val >>> i) & 1);
}

export function dataCodewords(segments: Segment[], version: number, ecl: Ecl): number[] {
  const bits: number[] = [];
  for (const s of segments) {
    appendBits(bits, modeIndicator(s.mode), 4);
    const chars = [...s.text];
    if (s.mode === "byte") {
      const bytes = utf8Bytes(s.text);
      appendBits(bits, bytes.length, countBits("byte", version));
      for (const b of bytes) appendBits(bits, b, 8);
    } else if (s.mode === "numeric") {
      appendBits(bits, chars.length, countBits("numeric", version));
      for (let i = 0; i < chars.length; i += 3) {
        const chunk = chars.slice(i, i + 3).join("");
        appendBits(bits, Number(chunk), chunk.length * 3 + 1);
      }
    } else {
      appendBits(bits, chars.length, countBits("alnum", version));
      for (let i = 0; i + 1 < chars.length; i += 2) appendBits(bits, ALNUM_CHARSET.indexOf(chars[i]) * 45 + ALNUM_CHARSET.indexOf(chars[i + 1]), 11);
      if (chars.length % 2) appendBits(bits, ALNUM_CHARSET.indexOf(chars[chars.length - 1]), 6);
    }
  }
  const capacity = numDataCodewords(version, ecl) * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  return out;
}

// Блоки + чередование; заодно номер блока и тип каждого итогового слова.
export function interleave(data: number[], version: number, ecl: Ecl) {
  const nb = numBlocks(version, ecl);
  const eccLen = eccPerBlock(version, ecl);
  const raw = Math.floor(numRawDataModules(version) / 8);
  const numShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eccLen);
  const blocks: number[][] = [];
  const meta: { data: number; ecc: number }[] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    meta.push({ data: dat.length, ecc: eccLen });
    if (i < numShort) dat.push(0); // заглушка, в поток не попадает
    blocks.push(dat.concat(ecc));
  }
  const codewords: number[] = [];
  const blockOf: number[] = [];
  const isEccWord: boolean[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) {
        codewords.push(block[i]);
        blockOf.push(j);
        // В коротком блоке позиция meta.data — заглушка (пропущена выше), коррекция идёт после неё.
        isEccWord.push(j < numShort ? i > meta[j].data : i >= meta[j].data);
      }
    });
  }
  return { codewords, blockOf, isEccWord, blocks: meta, rawBlocks: blocks, numShort, shortLen };
}

// ---- матрица ----

class Grid {
  size: number;
  modules: boolean[][];
  kind: ModuleKind[][];
  isFn: boolean[][];
  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.kind = Array.from({ length: size }, () => new Array<ModuleKind>(size).fill("data"));
    this.isFn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  setFn(x: number, y: number, dark: boolean, kind: ModuleKind) {
    this.modules[y][x] = dark;
    this.isFn[y][x] = true;
    this.kind[y][x] = kind;
  }
}

function formatBits(ecl: Ecl, mask: number): number {
  const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function drawFormat(g: Grid, ecl: Ecl, mask: number) {
  const bits = formatBits(ecl, mask);
  const s = g.size;
  for (let i = 0; i <= 5; i++) g.setFn(8, i, bit(bits, i), "format");
  g.setFn(8, 7, bit(bits, 6), "format");
  g.setFn(8, 8, bit(bits, 7), "format");
  g.setFn(7, 8, bit(bits, 8), "format");
  for (let i = 9; i < 15; i++) g.setFn(14 - i, 8, bit(bits, i), "format");
  for (let i = 0; i < 8; i++) g.setFn(s - 1 - i, 8, bit(bits, i), "format");
  for (let i = 8; i < 15; i++) g.setFn(8, s - 15 + i, bit(bits, i), "format");
  g.setFn(8, s - 8, true, "dark");
}

function drawFunctionPatterns(g: Grid, version: number, ecl: Ecl) {
  const s = g.size;
  for (let i = 0; i < s; i++) {
    g.setFn(6, i, i % 2 === 0, "timing");
    g.setFn(i, 6, i % 2 === 0, "timing");
  }
  for (const [cx, cy] of [
    [3, 3],
    [s - 4, 3],
    [3, s - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= s || y >= s) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        g.setFn(x, y, d !== 2 && d !== 4, d === 4 ? "separator" : "finder");
      }
  }
  const pos = alignmentPositions(version);
  const n = pos.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) g.setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, "alignment");
    }
  drawFormat(g, ecl, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = s - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.setFn(a, b, bit(bits, i), "version");
      g.setFn(b, a, bit(bits, i), "version");
    }
  }
}

function placeCodewords(g: Grid, codewords: number[]): Int16Array {
  const s = g.size;
  const at = new Int16Array(s * s).fill(-1);
  let i = 0;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? s - 1 - vert : vert;
        if (g.isFn[y][x]) continue;
        if (i < codewords.length * 8) {
          g.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          at[y * s + x] = i >>> 3;
          i++;
        } else g.kind[y][x] = "remainder";
      }
    }
  }
  return at;
}

export function maskCondition(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) if (!g.isFn[y][x] && maskCondition(mask, x, y)) g.modules[y][x] = !g.modules[y][x];
}

// Штраф маски по четырём правилам стандарта — по отдельности, чтобы экран
// анатомии мог показать, ЗА ЧТО выбрана маска.
export function penalty(modules: boolean[][]): Penalty {
  const s = modules.length;
  let runs = 0;
  let finderLike = 0;
  const addHistory = (len: number, h: number[]) => {
    if (h[0] === 0) len += s;
    h.pop();
    h.unshift(len);
  };
  const countPatterns = (h: number[]) => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  };
  const line = (get: (i: number) => boolean) => {
    let color = false;
    let run = 0;
    const h = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < s; i++) {
      if (get(i) === color) {
        run++;
        if (run === 5) runs += 3;
        else if (run > 5) runs++;
      } else {
        addHistory(run, h);
        if (!color) finderLike += countPatterns(h) * 40;
        color = get(i);
        run = 1;
      }
    }
    if (color) {
      addHistory(run, h);
      run = 0;
    }
    run += s;
    addHistory(run, h);
    finderLike += countPatterns(h) * 40;
  };
  for (let y = 0; y < s; y++) line((x) => modules[y][x]);
  for (let x = 0; x < s; x++) line((y) => modules[y][x]);
  let boxes = 0;
  for (let y = 0; y < s - 1; y++)
    for (let x = 0; x < s - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) boxes += 3;
    }
  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark++;
  const total = s * s;
  const balance = (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return { runs, boxes, finderLike, balance, total: runs + boxes + finderLike + balance };
}

export function encode(text: string, ecl: Ecl, opts: { minVersion?: number; forceMask?: number } = {}): QrCode {
  const { version, segments, bits } = chooseVersion(text, ecl, opts.minVersion);
  const data = dataCodewords(segments, version, ecl);
  const il = interleave(data, version, ecl);
  const size = symbolSize(version);
  const g = new Grid(size);
  drawFunctionPatterns(g, version, ecl);
  const at = placeCodewords(g, il.codewords);
  const penalties: Penalty[] = [];
  for (let m = 0; m < 8; m++) {
    applyMask(g, m);
    drawFormat(g, ecl, m);
    penalties.push(penalty(g.modules));
    applyMask(g, m);
  }
  let mask = 0;
  for (let m = 1; m < 8; m++) if (penalties[m].total < penalties[mask].total) mask = m;
  if (opts.forceMask !== undefined) mask = opts.forceMask;
  applyMask(g, mask);
  drawFormat(g, ecl, mask);
  return {
    version,
    ecl,
    size,
    mask,
    modules: g.modules,
    kind: g.kind,
    codewordAt: at,
    blockOf: il.blockOf,
    isEccWord: il.isEccWord,
    blocks: il.blocks,
    segments,
    dataBits: bits,
    capacityBits: numDataCodewords(version, ecl) * 8,
    penalties,
    codewords: il.codewords,
  };
}

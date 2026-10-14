import { test } from "node:test";
import assert from "node:assert/strict";
import { dataCodewords, encode, interleave, maskCondition, chooseVersion, CapacityError } from "./encode.ts";
import { optimalSegments, singleModeSegments, totalBits } from "./segments.ts";
import { rsSyndromes } from "./gf.ts";
import { alignmentPositions, correctablePerBlock, numDataCodewords, numRawDataModules, eccPerBlock, numBlocks, type Ecl } from "./tables.ts";

test("capacities match the standard at the corners of the table", () => {
  assert.equal(numDataCodewords(1, "L"), 19);
  assert.equal(numDataCodewords(1, "M"), 16);
  assert.equal(numDataCodewords(1, "Q"), 13);
  assert.equal(numDataCodewords(1, "H"), 9);
  assert.equal(numDataCodewords(5, "Q"), 62);
  assert.equal(numDataCodewords(10, "M"), 216);
  assert.equal(numDataCodewords(40, "L"), 2956);
  assert.equal(numDataCodewords(40, "H"), 1276);
  // Таблица 7 стандарта (кодовых слов данных L/M/Q/H) — поймала опечатку 80→81 блоков у 40-H.
  const known: Record<number, number[]> = {
    2: [34, 28, 22, 16], 3: [55, 44, 34, 26], 4: [80, 64, 48, 36], 6: [136, 108, 76, 60], 7: [156, 124, 88, 66],
    8: [194, 154, 110, 86], 9: [232, 182, 132, 100], 10: [274, 216, 154, 122], 15: [523, 415, 295, 223],
    20: [861, 669, 485, 385], 25: [1276, 1000, 718, 538], 30: [1735, 1373, 985, 745], 35: [2306, 1812, 1286, 986], 39: [2812, 2216, 1582, 1222],
  };
  for (const [v, row] of Object.entries(known)) (["L", "M", "Q", "H"] as Ecl[]).forEach((e, i) => assert.equal(numDataCodewords(Number(v), e), row[i], `v${v}${e}`));
  for (let v = 1; v <= 40; v++)
    for (const e of ["L", "M", "Q", "H"] as Ecl[]) {
      const raw = Math.floor(numRawDataModules(v) / 8);
      assert.ok(raw - eccPerBlock(v, e) * numBlocks(v, e) > 0);
    }
});

test("alignment positions", () => {
  assert.deepEqual(alignmentPositions(2), [6, 18]);
  assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
  assert.deepEqual(alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
});

test("HELLO WORLD encodes to the textbook codewords (1-Q and 1-M with ECC)", () => {
  const segs = optimalSegments("HELLO WORLD", 1);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].mode, "alnum");
  assert.deepEqual(dataCodewords(segs, 1, "Q"), [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]);
  const m = dataCodewords(segs, 1, "M");
  assert.deepEqual(m, [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
  const il = interleave(m, 1, "M");
  assert.deepEqual(il.codewords.slice(16), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test("optimal segmentation beats a single mode on mixed content", () => {
  const text = "https://shop.example.com/item?id=0012345678901234";
  const opt = totalBits(optimalSegments(text, 3), 3);
  const single = totalBits(singleModeSegments(text, 3), 3);
  assert.ok(opt < single, `${opt} vs ${single}`);
  const digits = "01234567890123456789";
  assert.equal(optimalSegments(digits, 1)[0].mode, "numeric");
  // Короткая цифровая вставка в тексте не стоит смены режима.
  assert.equal(optimalSegments("abc12def", 1).length, 1);
});

test("version grows with content and capacity errors are explicit", () => {
  assert.equal(chooseVersion("hi", "L").version, 1);
  assert.ok(chooseVersion("x".repeat(200), "M").version > 5);
  assert.throws(() => chooseVersion("x".repeat(4000), "H"), CapacityError);
});

// Обратное чтение матрицы: снять маску, пройти зигзагом, разобрать блоки
// и убедиться, что каждый блок — корректное кодовое слово Рида — Соломона.
function readBack(text: string, ecl: Ecl) {
  const q = encode(text, ecl);
  const s = q.size;
  const bits: number[] = [];
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? s - 1 - vert : vert;
        if (q.kind[y][x] !== "data") continue;
        bits.push(Number(q.modules[y][x] !== maskCondition(q.mask, x, y)));
      }
  }
  const words: number[] = [];
  for (let i = 0; i + 8 <= bits.length && words.length < q.codewords.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    words.push(b);
  }
  return { q, words };
}

test("matrix reads back to the same codewords and every block has zero syndromes", () => {
  for (const [text, ecl] of [
    ["HELLO WORLD", "Q"],
    ["https://example.com/a/very/long/path?with=query&and=more", "M"],
    ["WIFI:T:WPA;S:Home;P:correct horse battery staple;;", "H"],
    ["Ünïcödé — ✓ 日本語", "L"],
    ["x".repeat(300), "Q"],
  ] as [string, Ecl][]) {
    const { q, words } = readBack(text, ecl);
    assert.deepEqual(words, q.codewords, text);
    const byBlock: number[][] = q.blocks.map(() => []);
    words.forEach((w, i) => byBlock[q.blockOf[i]].push(w));
    byBlock.forEach((blk, j) => {
      assert.equal(blk.length, q.blocks[j].data + q.blocks[j].ecc);
      assert.ok(rsSyndromes(blk, q.blocks[j].ecc).every((v) => v === 0), `${text} block ${j}`);
    });
  }
});

test("the chosen mask has the lowest penalty and the format bits carry it", () => {
  const q = encode("https://example.com", "M");
  const min = Math.min(...q.penalties.map((p) => p.total));
  assert.equal(q.penalties[q.mask].total, min);
  assert.equal(q.penalties.findIndex((p) => p.total === min), q.mask);
  // Формат читается обратно из первой копии и совпадает с ECL+маской.
  const s = q.size;
  let bits = 0;
  const read = (x: number, y: number, i: number) => (bits |= Number(q.modules[y][x]) << i);
  for (let i = 0; i <= 5; i++) read(8, i, i);
  read(8, 7, 6);
  read(8, 8, 7);
  read(7, 8, 8);
  for (let i = 9; i < 15; i++) read(14 - i, 8, i);
  const data = (bits ^ 0x5412) >>> 10;
  assert.equal(data & 7, q.mask);
  assert.equal(data >> 3, 0); // M = 00
  assert.equal(q.modules[s - 8][8], true); // тёмный модуль
});

test("module map: finder corners, codeword ownership and correctable counts", () => {
  const q = encode("hello", "L");
  assert.equal(q.kind[0][0], "finder");
  assert.equal(q.kind[3][3], "finder");
  let data = 0;
  for (let i = 0; i < q.codewordAt.length; i++) if (q.codewordAt[i] >= 0) data++;
  assert.equal(data, q.codewords.length * 8);
  assert.equal(correctablePerBlock(1, "L"), 2); // (7 − 3 зарезервированных) / 2
  assert.equal(correctablePerBlock(1, "H"), 8);
  assert.equal(correctablePerBlock(10, "Q"), 12);
  const eccCount = q.isEccWord.filter(Boolean).length;
  assert.equal(eccCount, q.blocks.reduce((s, b) => s + b.ecc, 0));
});

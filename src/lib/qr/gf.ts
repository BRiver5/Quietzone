// Арифметика поля GF(2^8) с примитивным многочленом x^8+x^4+x^3+x^2+1 (0x11D)
// и кодер Рида — Соломона для QR (ISO/IEC 18004).

export function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

// Порождающий многочлен степени `degree`: ∏ (x − α^i), коэффициенты от старшего
// (старший 1 опущен).
export function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

// Остаток от деления data·x^degree на порождающий многочлен = кодовые слова коррекции.
export function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

// Синдромы блока (данные+коррекция): все нули ⇔ ошибок нет. Нужны тестам,
// чтобы проверить матрицу "обратным чтением", а не верой.
export function rsSyndromes(block: number[], eccLen: number): number[] {
  const out: number[] = [];
  let alpha = 1;
  for (let i = 0; i < eccLen; i++) {
    let s = 0;
    for (const b of block) s = gfMul(s, alpha) ^ b;
    out.push(s);
    alpha = gfMul(alpha, 0x02);
  }
  return out;
}

import { CapacityError, encode, type QrCode } from "./qr/encode.ts";
import { ECL_ORDER, numDataCodewords, type Ecl } from "./qr/tables.ts";
import { damageFor, maxSafeLogo, type DamageReport } from "./damage.ts";
import { contrast, luminance, maxDistanceCm, minPrintMm, moduleMm } from "./print.ts";

// Вершина цепочки: кодер → карта модулей → повреждения логотипом → физика
// печати с порогом, выученным профилем. Возвращает проверки с цифрами и,
// если что-то не так, РАНЖИРОВАННЫЕ варианты — каждый проверен повторным
// прогоном всей цепочки, а не угадан.

export type Design = {
  payload: string;
  ecl: Ecl;
  logoFrac: number; // 0 — без логотипа
  fg: string;
  bg: string;
  quiet: number; // модулей тихой зоны
  printMm: number; // сторона напечатанного кода с тихой зоной
  distanceCm: number;
  ratio: number; // мм модуля на 10 см — из профиля печати
};

export type Status = "ok" | "warn" | "fail";
export type Check = { key: "content" | "logo" | "contrast" | "quiet" | "size"; label: string; status: Status; detail: string };

export type Evaluation = {
  design: Design;
  qr: QrCode | null;
  damage: DamageReport | null;
  moduleMm: number;
  maxDistanceCm: number;
  checks: Check[];
  verdict: Status;
};

const rank: Record<Status, number> = { ok: 0, warn: 1, fail: 2 };
const worst = (a: Status, b: Status): Status => (rank[a] >= rank[b] ? a : b);
const mm = (v: number) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} mm`;

export function evaluate(d: Design): Evaluation {
  const checks: Check[] = [];
  let qr: QrCode | null = null;
  try {
    qr = d.payload ? encode(d.payload, d.ecl) : null;
  } catch (e) {
    if (!(e instanceof CapacityError)) throw e;
  }
  if (!d.payload) checks.push({ key: "content", label: "Content", status: "fail", detail: "Nothing to encode yet." });
  else if (!qr) checks.push({ key: "content", label: "Content", status: "fail", detail: `Too long for any QR size at level ${d.ecl}.` });
  else {
    const fill = qr.dataBits / qr.capacityBits;
    checks.push({
      key: "content",
      label: "Content",
      status: qr.version > 10 ? "warn" : "ok",
      detail: `Version ${qr.version}, ${qr.size}×${qr.size} modules, ${Math.round(fill * 100)}% of its capacity used.${qr.version > 10 ? " Dense codes need a bigger print." : ""}`,
    });
  }

  let damage: DamageReport | null = null;
  if (qr) {
    damage = damageFor(qr, d.logoFrac);
    if (d.logoFrac > 0) {
      const w = damage.worst;
      const load = w ? `${w.hit} of ${w.capacity} correctable codewords in block ${w.block + 1}` : "";
      const status: Status = damage.status === "broken" ? "fail" : damage.status === "risky" ? "warn" : "ok";
      const detail = damage.criticalHits.length
        ? `Covers ${damage.criticalHits.map((c) => `${c.count} ${c.kind}`).join(", ")} modules — scanners need those intact.`
        : `Worst block: ${load} (${Math.round((w?.ratio ?? 0) * 100)}% of what it can fix).`;
      checks.push({ key: "logo", label: "Logo", status, detail });
    }
  }

  const c = contrast(d.fg, d.bg);
  const inverted = luminance(d.fg) > luminance(d.bg);
  checks.push({
    key: "contrast",
    label: "Contrast",
    status: c < 3 ? "fail" : c < 4.5 || inverted ? "warn" : "ok",
    detail: `${c.toFixed(1)}:1${inverted ? " — light code on a dark background; many scanners expect dark on light" : c < 4.5 ? " — aim for 4.5:1 or more" : ""}.`,
  });

  checks.push({
    key: "quiet",
    label: "Quiet zone",
    status: d.quiet >= 4 ? "ok" : d.quiet >= 2 ? "warn" : "fail",
    detail: d.quiet >= 4 ? `${d.quiet} modules of blank margin.` : `${d.quiet} modules; the standard asks for 4 — busy surroundings confuse scanners.`,
  });

  let modMm = 0;
  let maxDist = 0;
  if (qr) {
    modMm = moduleMm(d.printMm, qr.size, d.quiet);
    maxDist = maxDistanceCm(d.printMm, qr.size, d.quiet, d.ratio);
    const need = (d.ratio * d.distanceCm) / 10;
    const k = modMm / need;
    checks.push({
      key: "size",
      label: "Size for distance",
      status: k >= 1 ? (modMm < 0.25 ? "warn" : "ok") : k >= 0.8 ? "warn" : "fail",
      detail: `Each module is ${mm(modMm)}; reading from ${d.distanceCm} cm needs ${mm(need)}. Reliable up to ~${Math.round(maxDist)} cm.${modMm < 0.25 ? " Below 0.25 mm most printers smear modules." : ""}`,
    });
  }

  const verdict = checks.reduce<Status>((a, ch) => worst(a, ch.status), "ok");
  return { design: d, qr, damage, moduleMm: modMm, maxDistanceCm: maxDist, checks, verdict };
}

export type Fix = {
  key: string;
  title: string;
  detail: string;
  patch: Partial<Design>;
  after: Evaluation;
  effort: number; // 0 — ничего не теряешь … 4 — меняешь содержимое
};

const effortOf = { colors: 0, quiet: 0, closer: 1, shrinkLogo: 2, raiseEcl: 2, raiseAndShrink: 2, lowerEcl: 2, bigger: 3, dropLogo: 3 } as const;

export function suggestFixes(e: Evaluation): Fix[] {
  if (e.verdict === "ok" || !e.design.payload) return [];
  const d = e.design;
  const out: Fix[] = [];
  const tryPatch = (key: keyof typeof effortOf, title: string, detail: (a: Evaluation) => string, patch: Partial<Design>) => {
    const after = evaluate({ ...d, ...patch });
    if (rank[after.verdict] > rank[e.verdict]) return;
    if (after.verdict === e.verdict && after.checks.filter((c) => c.status !== "ok").length >= e.checks.filter((c) => c.status !== "ok").length) return;
    out.push({ key, title, detail: detail(after), patch, after, effort: effortOf[key] });
  };
  const bad = (k: Check["key"]) => e.checks.some((c) => c.key === k && c.status !== "ok");

  if (bad("contrast")) tryPatch("colors", "Use black on white", () => "Maximum contrast, no inversion.", { fg: "#000000", bg: "#FFFFFF" });
  if (bad("quiet")) tryPatch("quiet", "Restore a 4-module margin", (a) => `Code itself shrinks to ${mm(a.moduleMm)} per module.`, { quiet: 4 });

  if (e.qr && bad("logo")) {
    const safe = maxSafeLogo(e.qr);
    if (safe > 0) tryPatch("shrinkLogo", `Shrink the logo to ${Math.round(safe * 100)}%`, () => `Largest size that keeps every block within budget at level ${d.ecl}.`, { logoFrac: safe });
    const idx = ECL_ORDER.indexOf(d.ecl);
    for (const ecl of ECL_ORDER.slice(idx + 1)) {
      tryPatch("raiseEcl", `Raise error correction to ${ecl}`, (a) => `Version ${e.qr!.version} → ${a.qr?.version ?? "?"}; modules ${mm(e.moduleMm)} → ${mm(a.moduleMm)}.`, { ecl });
      // Одного повышения часто мало: тогда — уровень выше И логотип под его бюджет.
      let raised: QrCode | null = null;
      try {
        raised = encode(d.payload, ecl);
      } catch {
        raised = null;
      }
      const fit = raised ? maxSafeLogo(raised) : 0;
      if (fit > 0 && fit < d.logoFrac)
        tryPatch("raiseAndShrink", `Level ${ecl} with a ${Math.round(fit * 100)}% logo`, (a) => `Keeps a logo while every block stays within budget; modules ${mm(a.moduleMm)}.`, { ecl, logoFrac: fit });
    }
    tryPatch("dropLogo", "Drop the logo", () => "The code alone, nothing covering its modules.", { logoFrac: 0 });
  }

  if (e.qr && bad("size")) {
    const need = Math.ceil(minPrintMm(e.qr.size, d.quiet, d.distanceCm, d.ratio) / 5) * 5;
    tryPatch("bigger", `Print it ${need} mm wide`, () => `Up from ${d.printMm} mm — the smallest size that reads from ${d.distanceCm} cm.`, { printMm: need });
    const near = Math.max(5, Math.floor(e.maxDistanceCm / 5) * 5);
    if (near < d.distanceCm) tryPatch("closer", `Scan from ${near} cm`, () => `At ${d.printMm} mm wide this is the reliable reach.`, { distanceCm: near });
    const idx = ECL_ORDER.indexOf(d.ecl);
    if (idx > 0 && d.logoFrac === 0) {
      tryPatch("lowerEcl", `Lower error correction to ${ECL_ORDER[idx - 1]}`, (a) => `Fewer modules (${e.qr!.size} → ${a.qr?.size ?? "?"}), so each is bigger at the same print size.`, { ecl: ECL_ORDER[idx - 1] });
    }
  }

  // Полностью чинит → меньше усилий → больше дальность.
  out.sort((a, b) => rank[a.after.verdict] - rank[b.after.verdict] || a.effort - b.effort || b.after.maxDistanceCm - a.after.maxDistanceCm);
  return out;
}

// Насколько сократить содержимое, чтобы код стал на версию меньше.
export function bytesToShrink(qr: QrCode): number | null {
  if (qr.version <= 1) return null;
  const prevCap = numDataCodewords(qr.version - 1, qr.ecl) * 8;
  const over = qr.dataBits - prevCap;
  return over > 0 ? Math.ceil(over / 8) : 0;
}

export type DesignDiff = { field: string; before: string; after: string; better: boolean | null }[];

export function diffEvaluations(a: Evaluation, b: Evaluation): DesignDiff {
  const v = (e: Evaluation) => e.qr;
  const rows: DesignDiff = [
    { field: "Version", before: v(a) ? String(v(a)!.version) : "—", after: v(b) ? String(v(b)!.version) : "—", better: v(a) && v(b) ? (v(b)!.version === v(a)!.version ? null : v(b)!.version < v(a)!.version) : null },
    { field: "Module size", before: mm(a.moduleMm), after: mm(b.moduleMm), better: a.moduleMm === b.moduleMm ? null : b.moduleMm > a.moduleMm },
    { field: "Reads from", before: `${Math.round(a.maxDistanceCm)} cm`, after: `${Math.round(b.maxDistanceCm)} cm`, better: Math.round(a.maxDistanceCm) === Math.round(b.maxDistanceCm) ? null : b.maxDistanceCm > a.maxDistanceCm },
  ];
  const load = (e: Evaluation) => (e.damage?.worst ? e.damage.worst.ratio : 0);
  if (a.design.logoFrac > 0 || b.design.logoFrac > 0)
    rows.push({ field: "Worst block load", before: `${Math.round(load(a) * 100)}%`, after: `${Math.round(load(b) * 100)}%`, better: load(a) === load(b) ? null : load(b) < load(a) });
  rows.push({ field: "Verdict", before: a.verdict, after: b.verdict, better: a.verdict === b.verdict ? null : rank[b.verdict] < rank[a.verdict] });
  return rows;
}

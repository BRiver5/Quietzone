import { test } from "node:test";
import assert from "node:assert/strict";
import { encode } from "./qr/encode.ts";
import { damageFor, maxSafeLogo, LOGO_BUDGET } from "./damage.ts";
import { buildPayload, escapeMeta } from "./content.ts";
import { contrast, maxDistanceCm, minPrintMm, moduleMm } from "./print.ts";
import { priorPosterior, summarize, update, successProb, gridValue, GRID_N } from "./profile.ts";
import { evaluate, suggestFixes, diffEvaluations, bytesToShrink, type Design } from "./advisor.ts";

test("payloads escape the characters that would otherwise cut a field short", () => {
  assert.equal(escapeMeta('a;b,c:d\\e"'), 'a\\;b\\,c\\:d\\\\e\\"');
  assert.equal(buildPayload("wifi", { ssid: "Home;5G", password: "p:ss", security: "wpa" }), "WIFI:T:WPA;S:Home\\;5G;P:p\\:ss;;");
  assert.equal(buildPayload("wifi", { ssid: "Cafe", password: "" }), "WIFI:T:nopass;S:Cafe;;");
  assert.equal(buildPayload("url", { url: "example.com" }), "https://example.com");
  assert.equal(buildPayload("phone", { number: "+1 (555) 010-0" }), "tel:+15550100");
  assert.equal(buildPayload("contact", { name: "Alex", phone: "555 01" }), "MECARD:N:Alex;TEL:55501;;");
});

test("logo damage is counted per block and grows with the logo", () => {
  const q = encode("https://example.com/menu/today", "H");
  const small = damageFor(q, 0.1);
  const big = damageFor(q, 0.3);
  assert.equal(small.status, "safe");
  assert.ok((big.worst?.hit ?? 0) > (small.worst?.hit ?? 0));
  const none = damageFor(q, 0);
  assert.equal(none.status, "clean");
  assert.equal(none.blocks.every((b) => b.hit === 0), true);
});

test("a logo that reaches the finder patterns is broken whatever the error correction", () => {
  const q = encode("hi", "H");
  assert.equal(damageFor(q, 0.9).status, "broken");
  assert.ok(damageFor(q, 0.9).criticalHits.some((c) => c.kind === "finder" || c.kind === "timing"));
});

test("max safe logo respects the budget and higher ECC allows a bigger logo", () => {
  const text = "https://example.com/some/landing/page";
  const l = maxSafeLogo(encode(text, "L"));
  const h = maxSafeLogo(encode(text, "H"));
  assert.ok(h > l, `${h} vs ${l}`);
  const d = damageFor(encode(text, "H"), h);
  assert.ok((d.worst?.ratio ?? 0) <= LOGO_BUDGET);
});

test("print math is consistent both ways", () => {
  const mmv = moduleMm(33, 25, 4);
  assert.ok(Math.abs(mmv - 1) < 1e-9);
  const need = minPrintMm(25, 4, 30, 0.3);
  assert.ok(Math.abs(maxDistanceCm(need, 25, 4, 0.3) - 30) < 1e-9);
  assert.ok(Math.abs(contrast("#000000", "#FFFFFF") - 21) < 1e-9);
});

test("the print profile accumulates: failures push the threshold up, successes down", () => {
  let p = priorPosterior();
  const base = summarize(p, 0).median;
  for (let i = 0; i < 4; i++) p = update(p, { moduleMm: 0.5, distanceCm: 10, ok: false });
  const afterFails = summarize(p, 4).median;
  assert.ok(afterFails > base, `${afterFails} vs ${base}`);
  let q = priorPosterior();
  for (let i = 0; i < 4; i++) q = update(q, { moduleMm: 0.2, distanceCm: 10, ok: true });
  assert.ok(summarize(q, 4).median < base);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  // Модель отличает "хороший запас" от "впритык".
  assert.ok(successProb(gridValue(GRID_N - 1), gridValue(0)) > 0.9);
  // Порядок наблюдений не важен — апостериор один и тот же.
  const t1 = { moduleMm: 0.4, distanceCm: 20, ok: true };
  const t2 = { moduleMm: 0.3, distanceCm: 30, ok: false };
  const a = update(update(priorPosterior(), t1), t2);
  const b = update(update(priorPosterior(), t2), t1);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-12));
});

const base: Design = { payload: "https://example.com/menu", ecl: "M", logoFrac: 0, fg: "#000000", bg: "#FFFFFF", quiet: 4, printMm: 30, distanceCm: 20, ratio: 0.3 };

test("a plain black-on-white code at a sane size passes every check", () => {
  const e = evaluate(base);
  assert.equal(e.verdict, "ok");
  assert.deepEqual(suggestFixes(e), []);
});

test("too small for the distance: fixes are verified and ranked, the best one actually fixes it", () => {
  const e = evaluate({ ...base, printMm: 15, distanceCm: 60 });
  assert.equal(e.verdict, "fail");
  const fixes = suggestFixes(e);
  assert.ok(fixes.length >= 2);
  assert.equal(fixes[0].after.verdict, "ok");
  assert.ok(fixes.every((f, i) => i === 0 || f.after.verdict !== "ok" || f.effort >= fixes[0].effort));
});

test("an oversized logo at level L: shrink or raise ECC are offered, and both are checked", () => {
  const e = evaluate({ ...base, ecl: "L", logoFrac: 0.3, printMm: 60 });
  assert.notEqual(e.verdict, "ok");
  const fixes = suggestFixes(e);
  const keys = fixes.map((f) => f.key);
  assert.ok(keys.includes("raiseAndShrink") || keys.includes("shrinkLogo") || keys.includes("raiseEcl"), keys.join());
  assert.ok(keys.includes("dropLogo"));
  assert.equal(fixes[0].after.verdict, "ok");
  for (const f of fixes) assert.ok(f.after.verdict !== "fail" || f.after.checks.length > 0);
});

test("what-if diff says which way each number moved", () => {
  const a = evaluate(base);
  const b = evaluate({ ...base, printMm: 45 });
  const rows = diffEvaluations(a, b);
  assert.equal(rows.find((r) => r.field === "Module size")?.better, true);
  assert.equal(rows.find((r) => r.field === "Version")?.better, null);
});

test("bytes to shrink to drop one version", () => {
  const q = encode("x".repeat(40), "M");
  const n = bytesToShrink(q);
  assert.ok(n !== null && n > 0);
  assert.ok(encode("x".repeat(40 - (n as number) - 2), "M").version < q.version);
});

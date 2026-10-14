import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import type { ContentType, Fields } from "../lib/content.ts";
import type { Ecl } from "../lib/qr/tables.ts";
import { priorPosterior, update, type ScanTest } from "../lib/profile.ts";
import { todayLocal } from "../lib/time.ts";

export type LogoIcon = "none" | "wifi" | "link" | "phone" | "mail" | "user" | "star" | "coffee";

export type Code = {
  id: string;
  title: string;
  type: ContentType;
  fields: Fields;
  ecl: Ecl;
  logoFrac: number;
  logoIcon: LogoIcon;
  fg: string;
  bg: string;
  quiet: number;
  printMm: number;
  distanceCm: number;
  profileId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Profile = { id: string; name: string; kind: ProfileKind; posterior: number[]; tests: number; createdAt: string };
export type ProfileKind = "laser" | "inkjet" | "label" | "screen";

export type TestRow = { id: string; profileId: string; codeId: string | null; moduleMm: number; distanceCm: number; ok: boolean; date: string };
export type ExportRow = { id: string; codeId: string; kind: "print" | "share"; printMm: number | null; date: string };

export type Settings = { defaultEcl: Ecl; defaultPrintMm: number; defaultDistanceCm: number; haptics: boolean; defaultProfileId: string | null };
export const DEFAULT_SETTINGS: Settings = { defaultEcl: "M", defaultPrintMm: 30, defaultDistanceCm: 25, haptics: true, defaultProfileId: null };

// Пресеты профилей: априорный центр порога (мм модуля на 10 см) — от правила
// "10 ширин кода", чуть строже для экранов (блики, муар) и термопечати.
export const PROFILE_PRESETS: { kind: ProfileKind; name: string; center: number }[] = [
  { kind: "laser", name: "Office laser printer", center: 0.27 },
  { kind: "inkjet", name: "Home inkjet", center: 0.3 },
  { kind: "label", name: "Label / thermal printer", center: 0.38 },
  { kind: "screen", name: "Phone or monitor screen", center: 0.36 },
];

export async function loadAll() {
  const db = await getDb();
  const codes = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM codes ORDER BY updated_at DESC");
  const profiles = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM profiles ORDER BY created_at");
  const tests = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM scan_tests ORDER BY date");
  const exports = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM exports ORDER BY date");
  const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings");
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const r of srows) if (r.key in settings) (settings as Record<string, unknown>)[r.key] = JSON.parse(r.value);
  return {
    codes: codes.map(
      (r): Code => ({
        id: r.id as string,
        title: r.title as string,
        type: r.type as ContentType,
        fields: JSON.parse(r.fields as string),
        ecl: r.ecl as Ecl,
        logoFrac: r.logo_frac as number,
        logoIcon: ((r.logo_icon as string) ?? "none") as LogoIcon,
        fg: r.fg as string,
        bg: r.bg as string,
        quiet: r.quiet as number,
        printMm: r.print_mm as number,
        distanceCm: r.distance_cm as number,
        profileId: (r.profile_id as string) ?? null,
        pinned: !!r.pinned,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      })
    ),
    profiles: profiles.map(
      (r): Profile => ({ id: r.id as string, name: r.name as string, kind: r.kind as ProfileKind, posterior: JSON.parse(r.posterior as string), tests: r.tests as number, createdAt: r.created_at as string })
    ),
    tests: tests.map((r): TestRow => ({ id: r.id as string, profileId: r.profile_id as string, codeId: (r.code_id as string) ?? null, moduleMm: r.module_mm as number, distanceCm: r.distance_cm as number, ok: !!r.ok, date: r.date as string })),
    exports: exports.map((r): ExportRow => ({ id: r.id as string, codeId: r.code_id as string, kind: r.kind as "print" | "share", printMm: (r.print_mm as number) ?? null, date: r.date as string })),
    settings,
  };
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, JSON.stringify(value));
}

export async function createCode(c: Omit<Code, "id" | "createdAt" | "updatedAt" | "pinned">): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO codes (id, title, type, fields, ecl, logo_frac, logo_icon, fg, bg, quiet, print_mm, distance_cm, profile_id, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id, c.title, c.type, JSON.stringify(c.fields), c.ecl, c.logoFrac, c.logoIcon, c.fg, c.bg, c.quiet, c.printMm, c.distanceCm, c.profileId, now, now
  );
  return id;
}

const COLS: Record<string, string> = {
  title: "title", fields: "fields", ecl: "ecl", logoFrac: "logo_frac", logoIcon: "logo_icon", fg: "fg", bg: "bg",
  quiet: "quiet", printMm: "print_mm", distanceCm: "distance_cm", profileId: "profile_id", pinned: "pinned",
};

export async function patchCode(id: string, patch: Partial<Omit<Code, "id" | "type" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  const keys = Object.keys(patch).filter((k) => k in COLS);
  if (!keys.length) return;
  const vals = keys.map((k) => {
    const v = (patch as Record<string, unknown>)[k];
    if (k === "fields") return JSON.stringify(v);
    if (k === "pinned") return v ? 1 : 0;
    return v as string | number | null;
  });
  await db.runAsync(`UPDATE codes SET ${keys.map((k) => `${COLS[k]} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...vals, new Date().toISOString(), id);
}

export async function duplicateCode(c: Code): Promise<string> {
  const { id: _id, createdAt: _c, updatedAt: _u, pinned: _p, ...rest } = c;
  return createCode({ ...rest, title: `${c.title} copy` });
}

export async function deleteCode(id: string) {
  const db = await getDb();
  await db.runAsync("DELETE FROM codes WHERE id = ?", id);
  await db.runAsync("DELETE FROM exports WHERE code_id = ?", id);
  await db.runAsync("UPDATE scan_tests SET code_id = NULL WHERE code_id = ?", id);
}

export async function createProfile(kind: ProfileKind, name: string): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const preset = PROFILE_PRESETS.find((p) => p.kind === kind);
  await db.runAsync("INSERT INTO profiles (id, name, kind, posterior, tests, created_at) VALUES (?, ?, ?, ?, 0, ?)", id, name, kind, JSON.stringify(priorPosterior(preset?.center)), new Date().toISOString());
  return id;
}

export async function renameProfile(id: string, name: string) {
  const db = await getDb();
  await db.runAsync("UPDATE profiles SET name = ? WHERE id = ?", name, id);
}

export async function deleteProfile(id: string) {
  const db = await getDb();
  await db.runAsync("DELETE FROM profiles WHERE id = ?", id);
  await db.runAsync("DELETE FROM scan_tests WHERE profile_id = ?", id);
  await db.runAsync("UPDATE codes SET profile_id = NULL WHERE profile_id = ?", id);
}

// Тест сканирования: журнал + ОДНО инкрементальное обновление апостериора профиля.
export async function logScanTest(profile: Profile, codeId: string | null, t: ScanTest) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO scan_tests (id, profile_id, code_id, module_mm, distance_cm, ok, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    generateId(), profile.id, codeId, t.moduleMm, t.distanceCm, t.ok ? 1 : 0, todayLocal()
  );
  await db.runAsync("UPDATE profiles SET posterior = ?, tests = tests + 1 WHERE id = ?", JSON.stringify(update(profile.posterior, t)), profile.id);
}

export async function logExport(codeId: string, kind: "print" | "share", printMm: number | null) {
  const db = await getDb();
  await db.runAsync("INSERT INTO exports (id, code_id, kind, print_mm, date) VALUES (?, ?, ?, ?, ?)", generateId(), codeId, kind, printMm, todayLocal());
}

export async function resetAll() {
  const db = await getDb();
  await db.execAsync("DELETE FROM codes; DELETE FROM profiles; DELETE FROM scan_tests; DELETE FROM exports; DELETE FROM settings;");
}

// Удаление теста: накопленный апостериор не умеет "забыть" одно наблюдение,
// поэтому профиль пересобирается из априора и всех оставшихся тестов.
export async function deleteScanTest(testId: string, profile: Profile) {
  const db = await getDb();
  await db.runAsync("DELETE FROM scan_tests WHERE id = ?", testId);
  const rest = await db.getAllAsync<{ module_mm: number; distance_cm: number; ok: number }>("SELECT module_mm, distance_cm, ok FROM scan_tests WHERE profile_id = ? ORDER BY date", profile.id);
  const preset = PROFILE_PRESETS.find((p) => p.kind === profile.kind);
  let post = priorPosterior(preset?.center);
  for (const r of rest) post = update(post, { moduleMm: r.module_mm, distanceCm: r.distance_cm, ok: !!r.ok });
  await db.runAsync("UPDATE profiles SET posterior = ?, tests = ? WHERE id = ?", JSON.stringify(post), rest.length, profile.id);
}

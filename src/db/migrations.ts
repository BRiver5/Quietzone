import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию.
// Матрица кода нигде не хранится — она детерминированно пересобирается из
// содержимого и уровня коррекции. Профиль печати хранит НАКОПЛЕННЫЙ
// апостериор (posterior JSON), тесты сканирования — журнал для статистики.
const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS codes (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    fields TEXT NOT NULL,
    ecl TEXT NOT NULL,
    logo_frac REAL NOT NULL DEFAULT 0,
    logo_icon TEXT,
    fg TEXT NOT NULL,
    bg TEXT NOT NULL,
    quiet INTEGER NOT NULL DEFAULT 4,
    print_mm REAL NOT NULL,
    distance_cm REAL NOT NULL,
    profile_id TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    posterior TEXT NOT NULL,
    tests INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scan_tests (
    id TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL,
    code_id TEXT,
    module_mm REAL NOT NULL,
    distance_cm REAL NOT NULL,
    ok INTEGER NOT NULL,
    date TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY NOT NULL,
    code_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    print_mm REAL,
    date TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;
  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}

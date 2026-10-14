import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type Code, type ExportRow, type Profile, type Settings, type TestRow } from "../data/repo";
import { buildPayload } from "../lib/content.ts";
import { evaluate, type Design, type Evaluation } from "../lib/advisor.ts";
import { summarize } from "../lib/profile.ts";
import { DEFAULT_RATIO } from "../lib/print.ts";
import { setHapticsEnabled } from "../services/haptics";

type State = {
  ready: boolean;
  codes: Code[];
  profiles: Profile[];
  tests: TestRow[];
  exports: ExportRow[];
  settings: Settings;
  refresh: () => Promise<void>;
};

export const useApp = create<State>((set) => ({
  ready: false,
  codes: [],
  profiles: [],
  tests: [],
  exports: [],
  settings: DEFAULT_SETTINGS,
  refresh: async () => {
    const data = await loadAll();
    setHapticsEnabled(data.settings.haptics);
    set({ ready: true, ...data });
  },
}));

// Порог профиля (90-й перцентиль — с запасом) или правило по умолчанию.
export function ratioFor(profileId: string | null, profiles: Profile[]): number {
  const p = profiles.find((x) => x.id === profileId);
  return p ? summarize(p.posterior, p.tests).recommended : DEFAULT_RATIO;
}

export function designOf(c: Code, profiles: Profile[], override: Partial<Design> = {}): Design {
  return {
    payload: buildPayload(c.type, c.fields),
    ecl: c.ecl,
    logoFrac: c.logoFrac,
    fg: c.fg,
    bg: c.bg,
    quiet: c.quiet,
    printMm: c.printMm,
    distanceCm: c.distanceCm,
    ratio: ratioFor(c.profileId, profiles),
    ...override,
  };
}

// Кэш оценок по полному описанию дизайна: сетка библиотеки и экраны
// не перекодируют одно и то же на каждом рендере.
const cache = new Map<string, Evaluation>();
export function evaluateCached(d: Design): Evaluation {
  const key = JSON.stringify(d);
  let e = cache.get(key);
  if (!e) {
    e = evaluate(d);
    if (cache.size > 300) cache.clear();
    cache.set(key, e);
  }
  return e;
}

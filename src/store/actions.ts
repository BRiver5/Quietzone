import * as repo from "../data/repo";
import { useApp } from "./appStore";
import type { ScanTest } from "../lib/profile.ts";

const refresh = () => useApp.getState().refresh();

export async function addCode(c: Parameters<typeof repo.createCode>[0]) {
  const id = await repo.createCode(c);
  await refresh();
  return id;
}
export async function patchCode(id: string, patch: Parameters<typeof repo.patchCode>[1]) {
  await repo.patchCode(id, patch);
  await refresh();
}
export async function duplicate(c: repo.Code) {
  const id = await repo.duplicateCode(c);
  await refresh();
  return id;
}
export async function removeCode(id: string) {
  await repo.deleteCode(id);
  await refresh();
}
export async function addProfile(kind: repo.ProfileKind, name: string) {
  const id = await repo.createProfile(kind, name);
  await refresh();
  return id;
}
export async function renameProfile(id: string, name: string) {
  await repo.renameProfile(id, name);
  await refresh();
}
export async function removeProfile(id: string) {
  await repo.deleteProfile(id);
  await refresh();
}
export async function logTest(profile: repo.Profile, codeId: string | null, t: ScanTest) {
  await repo.logScanTest(profile, codeId, t);
  await refresh();
}
export async function logExport(codeId: string, kind: "print" | "share", printMm: number | null) {
  await repo.logExport(codeId, kind, printMm);
  await refresh();
}
export async function setSetting<K extends keyof repo.Settings>(key: K, value: repo.Settings[K]) {
  await repo.saveSetting(key, value);
  await refresh();
}
export async function wipe() {
  await repo.resetAll();
  await refresh();
}
export async function removeTest(testId: string, profile: repo.Profile) {
  await repo.deleteScanTest(testId, profile);
  await refresh();
}

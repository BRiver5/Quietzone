import { create } from "zustand";

// Сколько шторок открыто сейчас: подложка под строкой состояния затемняется
// вместе с экраном, иначе сверху оставалась светлая полоса над затемнением.
export const useUi = create<{ sheets: number; add: (d: number) => void }>((set) => ({
  sheets: 0,
  add: (d) => set((s) => ({ sheets: Math.max(0, s.sheets + d) })),
}));

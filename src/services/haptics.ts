// Тонкая обёртка над expo-haptics с глобальным выключателем из Settings.

import * as Haptics from "expo-haptics";

let enabled = true;
export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

const run = (fn: () => Promise<void>) => {
  if (enabled) fn().catch(() => {});
};

export const haptics = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  tick: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

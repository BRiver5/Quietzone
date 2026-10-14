// Локальные уведомления. Никаких точных будильников (SCHEDULE_EXACT_ALARM /
// USE_EXACT_ALARM) — эти разрешения заблокированы в app.json и предназначены
// только для приложений-будильников/календарей. Погрешность в пару минут для
// напоминания не критична.

import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function scheduleDaily(params: {
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(params.id).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: params.id,
    content: { title: params.title, body: params.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: params.hour,
      minute: params.minute,
    },
  });
}

export async function scheduleInterval(params: {
  id: string;
  seconds: number;
  title: string;
  body: string;
  repeats?: boolean;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(params.id).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: params.id,
    content: { title: params.title, body: params.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: params.seconds,
      repeats: params.repeats ?? false,
    },
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

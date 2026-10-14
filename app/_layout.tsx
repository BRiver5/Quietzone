import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
import { getDb } from "../src/db/client";
import { useTheme } from "../src/theme";
import { useApp } from "../src/store/appStore";
import { useUi } from "../src/store/uiStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({ IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
  const theme = useTheme();
  const refresh = useApp((s) => s.refresh);
  const loaded = useApp((s) => s.ready);

  useEffect(() => {
    getDb()
      .then(() => refresh())
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded]);

  // Пустой стор после горячей перезагрузки модуля — подгрузить заново, а не
  // отдавать экранам null (они рассчитывают на готовые данные).
  useEffect(() => {
    if (ready && !loaded) refresh().catch(() => {});
  }, [ready, loaded]);

  if (!ready || !fontsLoaded || !loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <StatusBackdrop color={theme.colors.background} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Подложка под строкой состояния: прокручиваемый контент иначе проезжал
// под часами и иконками (приложение рисуется edge-to-edge).
function StatusBackdrop({ color }: { color: string }) {
  const insets = useSafeAreaInsets();
  const dimmed = useUi((s) => s.sheets > 0);
  if (dimmed) color = "#8C908F"; // фон, затемнённый скримом шторки (bg × 0.55 + ink × 0.45)
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color }} />;
}

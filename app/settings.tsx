import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft, Printer, ShieldCheck, Trash2, Vibrate } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { Chip, IconButton, SectionTitle } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { PressableScale } from "../src/components/PressableScale";
import { ECL_ORDER, ECL_RECOVERY } from "../src/lib/qr/tables.ts";
import { summarize } from "../src/lib/profile.ts";
import * as actions from "../src/store/actions";

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useApp((st) => st.settings);
  const profiles = useApp((st) => st.profiles);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");

  const group = (title: string, children: React.ReactNode, i: number) => (
    <Animated.View key={title} entering={FadeInDown.delay(staggerDelay(i)).duration(380)} style={{ gap: 8 }}>
      <SectionTitle title={title} />
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 16, borderWidth: 1, borderColor: t.colors.border }}>{children}</View>
    </Animated.View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.title, color: t.colors.ink }}>Settings</Text>
      </View>

      {group(
        "New codes start with",
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Error correction</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {ECL_ORDER.map((l) => (
                <Chip key={l} label={`${l} · ${ECL_RECOVERY[l]}`} active={s.defaultEcl === l} onPress={() => actions.setSetting("defaultEcl", l)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Printer profile</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Rule of thumb" active={!s.defaultProfileId} onPress={() => actions.setSetting("defaultProfileId", null)} />
              {profiles.map((p) => (
                <Chip key={p.id} label={p.name} active={s.defaultProfileId === p.id} onPress={() => actions.setSetting("defaultProfileId", p.id)} />
              ))}
            </View>
          </View>
        </>,
        0
      )}

      {group(
        "Printer profiles",
        profiles.length ? (
          profiles.map((p) => {
            const sum = summarize(p.posterior, p.tests);
            return (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Printer size={17} color={t.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  {editing === p.id ? (
                    <TextInput
                      autoFocus
                      value={name}
                      onChangeText={setName}
                      onBlur={() => {
                        setEditing(null);
                        if (name.trim()) actions.renameProfile(p.id, name.trim());
                      }}
                      style={{ ...t.typography.label, color: t.colors.ink, borderBottomWidth: 2, borderColor: t.colors.accent, paddingVertical: 2 }}
                    />
                  ) : (
                    <PressableScale
                      onPress={() => {
                        setName(p.name);
                        setEditing(p.id);
                      }}
                    >
                      <Text style={{ ...t.typography.label, color: t.colors.ink }}>{p.name}</Text>
                    </PressableScale>
                  )}
                  <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
                    {sum.recommended.toFixed(2)} mm per 10 cm · {p.tests} test{p.tests === 1 ? "" : "s"} · {sum.confidence}
                  </Text>
                </View>
                <PressableScale
                  accessibilityLabel="Delete profile"
                  onPress={() =>
                    Alert.alert("Delete profile?", `“${p.name}” and its scan tests will be removed; codes fall back to the rule of thumb.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => actions.removeProfile(p.id) },
                    ])
                  }
                >
                  <Trash2 size={17} color={t.colors.inkFaint} />
                </PressableScale>
              </View>
            );
          })
        ) : (
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Create one from a code's “Print & test” screen. Tap a name here to rename it.</Text>
        ),
        1
      )}

      {group(
        "Feel",
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Vibrate size={18} color={t.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Haptics</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Ticks while sizing a logo and on every chip.</Text>
          </View>
          <Toggle value={s.haptics} onValueChange={(v) => actions.setSetting("haptics", v)} />
        </View>,
        2
      )}

      {group(
        "Data",
        <>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <ShieldCheck size={18} color={t.colors.accent} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1 }}>
              Codes are generated on this phone. No account, no network access, no camera — nothing leaves the device unless you print or share it.
            </Text>
          </View>
          <PressableScale
            onPress={() =>
              Alert.alert("Erase all data?", "Codes, printer profiles, scan tests and settings will be deleted.", [
                { text: "Cancel", style: "cancel" },
                { text: "Erase", style: "destructive", onPress: () => actions.wipe() },
              ])
            }
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Trash2 size={18} color={t.colors.danger} />
            <Text style={{ ...t.typography.label, color: t.colors.danger }}>Erase all data</Text>
          </PressableScale>
        </>,
        3
      )}
    </ScrollView>
  );
}

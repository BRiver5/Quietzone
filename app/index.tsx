import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChartColumn, Copy, Pin, PinOff, Plus, Search, Settings, Trash2, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { contentColors, statusColor } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp, designOf, evaluateCached } from "../src/store/appStore";
import { Chip, IconButton, SectionTitle } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { QRView } from "../src/components/QRView";
import { NewCodeSheet, TYPE_ICON } from "../src/components/NewCodeSheet";
import { Sheet } from "../src/components/Sheet";
import { VERDICT_TEXT } from "../src/components/Checks";
import { CONTENT_LABELS, summary, type ContentType } from "../src/lib/content.ts";
import * as actions from "../src/store/actions";
import type { Code } from "../src/data/repo";

export default function Library() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const codes = useApp((s) => s.codes);
  const profiles = useApp((s) => s.profiles);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ContentType | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [menu, setMenu] = useState<Code | null>(null);

  const cardW = (width - 40 - 12) / 2;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return codes.filter((c) => (!type || c.type === type) && (!q || c.title.toLowerCase().includes(q) || summary(c.type, c.fields).toLowerCase().includes(q)));
  }, [codes, query, type]);
  const usedTypes = (Object.keys(CONTENT_LABELS) as ContentType[]).filter((k) => codes.some((c) => c.type === k));

  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned);
  const children: React.ReactNode[] = [];
  const sticky: number[] = [];

  children.push(
    <View key="top" style={{ gap: 12, paddingBottom: 6 }}>
      {codes.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 14 }}>
          <Search size={16} color={t.colors.inkFaint} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search codes" placeholderTextColor={t.colors.inkFaint} style={{ flex: 1, paddingVertical: 10, color: t.colors.ink, ...t.typography.body }} />
          {query ? (
            <PressableScale onPress={() => setQuery("")} accessibilityLabel="Clear search">
              <X size={16} color={t.colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {usedTypes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="All" active={type === null} onPress={() => setType(null)} />
          {usedTypes.map((k) => (
            <Chip key={k} label={CONTENT_LABELS[k]} color={contentColors[k]} active={type === k} onPress={() => setType(type === k ? null : k)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const grid = (list: Code[], withAdd: boolean, keyPrefix: string) => {
    const cells: React.ReactNode[] = [];
    // Пустая библиотека: "+" на всю ширину — одна карточка в левой колонке выглядела обрубком.
    if (withAdd && !codes.length) {
      children.push(
        <Animated.View key="add-wide" entering={FadeInDown.duration(380)} style={{ marginBottom: 12 }}>
          <AddCard w={width - 40} onPress={() => setNewOpen(true)} empty />
        </Animated.View>
      );
    } else if (withAdd) cells.push(<AddCard key="add" w={cardW} onPress={() => setNewOpen(true)} empty={false} />);
    list.forEach((c) => cells.push(<CodeCard key={c.id} code={c} w={cardW} onMenu={() => setMenu(c)} profiles={profiles} />));
    for (let i = 0; i < cells.length; i += 2) {
      children.push(
        <Animated.View key={`${keyPrefix}-${i}`} entering={FadeInDown.delay(staggerDelay(i / 2)).duration(380)} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {cells[i]}
          {cells[i + 1] ?? <View style={{ width: cardW }} />}
        </Animated.View>
      );
    }
  };

  if (pinned.length) {
    sticky.push(children.length);
    children.push(<Header key="hp" title={`Pinned · ${pinned.length}`} />);
    grid(pinned, false, "p");
  }
  if (codes.length) {
    sticky.push(children.length);
    children.push(<Header key="ha" title={query || type ? `Matches · ${rest.length + pinned.length}` : `All codes · ${rest.length}`} />);
  }
  grid(rest, !query && !type, "a");
  if (!filtered.length && codes.length) {
    children.push(
      <Text key="none" style={{ ...t.typography.body, color: t.colors.inkMuted, textAlign: "center", paddingVertical: 24 }}>
        Nothing matches{query ? ` “${query}”` : ""}.
      </Text>
    );
  }
  if (!codes.length) children.push(<StartChecklist key="start" />);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.title, fontSize: 26, color: t.colors.ink }}>quietzone</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>QR codes that actually scan</Text>
        </View>
        <IconButton label="Stats" onPress={() => router.push("/stats")}>
          <ChartColumn size={18} color={t.colors.ink} />
        </IconButton>
        <IconButton label="Settings" onPress={() => router.push("/settings")}>
          <Settings size={18} color={t.colors.ink} />
        </IconButton>
      </View>
      <ScrollView stickyHeaderIndices={sticky} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>

      <NewCodeSheet visible={newOpen} onClose={() => setNewOpen(false)} />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title ?? ""} subtitle="Quick actions">
        {menu ? (
          <View style={{ gap: 2 }}>
            {[
              { icon: menu.pinned ? <PinOff size={18} color={t.colors.ink} /> : <Pin size={18} color={t.colors.ink} />, label: menu.pinned ? "Unpin" : "Pin to top", run: () => actions.patchCode(menu.id, { pinned: !menu.pinned }) },
              { icon: <Copy size={18} color={t.colors.ink} />, label: "Duplicate", run: () => actions.duplicate(menu) },
              {
                icon: <Trash2 size={18} color={t.colors.danger} />,
                label: "Delete",
                danger: true,
                run: () =>
                  Alert.alert("Delete code?", `“${menu.title}” and its export history will be removed.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => actions.removeCode(menu.id) },
                  ]),
              },
            ].map((it) => (
              <PressableScale
                key={it.label}
                onPress={() => {
                  setMenu(null);
                  setTimeout(it.run, 160);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 4 }}
              >
                {it.icon}
                <Text style={{ ...t.typography.body, color: it.danger ? t.colors.danger : t.colors.ink }}>{it.label}</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Header({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background, paddingVertical: 8 }}>
      <SectionTitle title={title} />
    </View>
  );
}

function CodeCard({ code, w, onMenu, profiles }: { code: Code; w: number; onMenu: () => void; profiles: ReturnType<typeof useApp.getState>["profiles"] }) {
  const t = useTheme();
  const e = evaluateCached(designOf(code, profiles));
  const inner = w - 24;
  return (
    <PressableScale
      onPress={() => router.push(`/code/${code.id}`)}
      onLongPress={onMenu}
      delayLongPress={350}
      scaleTo={0.97}
      style={{ width: w, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 12, gap: 10, borderWidth: 1, borderColor: t.colors.border }}
    >
      <View style={{ width: inner, height: inner, borderRadius: 10, overflow: "hidden", backgroundColor: code.bg, alignItems: "center", justifyContent: "center" }}>
        {e.qr ? (
          <QRView qr={e.qr} size={inner} fg={code.fg} bg={code.bg} quiet={2} logoFrac={code.logoFrac} logoIcon={code.logoIcon} />
        ) : (
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center", padding: 10 }}>Too long to encode</Text>
        )}
        {code.pinned ? (
          <View style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.accent, alignItems: "center", justifyContent: "center" }}>
            <Pin size={12} color={t.colors.onAccent} />
          </View>
        ) : null}
      </View>
      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {TYPE_ICON[code.type](contentColors[code.type], 13)}
          <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }} numberOfLines={1}>
            {code.title}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor[e.verdict] }} />
          <Text style={{ fontSize: 11, color: t.colors.inkMuted, flex: 1 }} numberOfLines={1}>
            {VERDICT_TEXT[e.verdict]}
          </Text>
          {e.qr ? <Text style={{ fontSize: 10, ...t.typography.number, color: t.colors.inkFaint }}>v{e.qr.version}</Text> : null}
        </View>
      </View>
    </PressableScale>
  );
}

function AddCard({ w, onPress, empty }: { w: number; onPress: () => void; empty: boolean }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={{ width: w, minHeight: empty ? 150 : w + 52, flexDirection: empty ? "row" : "column", borderRadius: t.radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.colors.accent, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: empty ? t.colors.accentSoft : "transparent" }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.colors.accent, alignItems: "center", justifyContent: "center" }}>
        <Plus size={22} color={t.colors.onAccent} />
      </View>
      <Text style={{ ...t.typography.label, color: t.colors.accentDeep }}>New code</Text>
    </PressableScale>
  );
}

function StartChecklist() {
  const t = useTheme();
  const steps = [
    ["Make a code", "Link, Wi-Fi, contact, text, email, phone or SMS."],
    ["Check it before you print", "Logo, colours and size are tested against how scanners actually read."],
    ["Teach it your printer", "Log a couple of scan tests — the size advice gets sharper with each one."],
  ];
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 20, gap: 16, borderWidth: 1, borderColor: t.colors.border }}>
      <Text style={{ ...t.typography.title, color: t.colors.ink }}>Codes that scan the first time</Text>
      {steps.map(([title, desc], i) => (
        <Animated.View key={title} entering={FadeInDown.delay(staggerDelay(i + 1)).duration(380)} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 1.5, borderColor: t.colors.accent, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? t.colors.accent : "transparent" }}>
            <Text style={{ ...t.typography.number, color: i === 0 ? t.colors.onAccent : t.colors.accent }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{title}</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{desc}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

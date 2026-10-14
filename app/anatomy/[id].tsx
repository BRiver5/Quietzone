import { useMemo, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { kindColors } from "../../src/theme/colors";
import { staggerDelay } from "../../src/theme/motion";
import { useApp, designOf, evaluateCached } from "../../src/store/appStore";
import { IconButton, SectionTitle } from "../../src/components/Bits";
import { AnatomyMap, BlockLegend, MaskBars, SegmentStrip } from "../../src/components/Anatomy";
import { QRView } from "../../src/components/QRView";
import { encode } from "../../src/lib/qr/encode.ts";
import { singleModeSegments, totalBits } from "../../src/lib/qr/segments.ts";
import { correctablePerBlock, ECL_RECOVERY } from "../../src/lib/qr/tables.ts";

const KIND_LEGEND: { key: keyof typeof kindColors; label: string }[] = [
  { key: "finder", label: "Finder" },
  { key: "timing", label: "Timing" },
  { key: "alignment", label: "Alignment" },
  { key: "format", label: "Format info" },
  { key: "version", label: "Version info" },
];

export default function AnatomyScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const code = useApp((s) => s.codes.find((c) => c.id === id));
  const profiles = useApp((s) => s.profiles);
  const [block, setBlock] = useState<number | null>(null);
  const [mask, setMask] = useState<number | null>(null);
  const e = code ? evaluateCached(designOf(code, profiles)) : null;
  const qr = e?.qr ?? null;
  const masked = useMemo(() => (qr && mask !== null && code ? encode(e!.design.payload, code.ecl, { forceMask: mask }) : null), [qr, mask]);

  if (!code || !e || !qr) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 20, alignItems: "center" }}>
        <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>Nothing to take apart yet.</Text>
      </View>
    );
  }
  const mapSize = width - 40 - 32;
  const single = totalBits(singleModeSegments(e.design.payload, qr.version), qr.version);
  const eccTotal = qr.blocks.reduce((s, b) => s + b.ecc, 0);
  const dataTotal = qr.blocks.reduce((s, b) => s + b.data, 0);
  const minPenalty = qr.penalties[qr.mask].total;

  const cards: { key: string; title: string; node: React.ReactNode }[] = [
    {
      key: "numbers",
      title: "The symbol",
      node: (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            ["Version", String(qr.version)],
            ["Modules", `${qr.size} × ${qr.size}`],
            ["Level", `${qr.ecl} · ${ECL_RECOVERY[qr.ecl]}`],
            ["Codewords", `${dataTotal} + ${eccTotal}`],
            ["Blocks", String(qr.blocks.length)],
            ["Fixable / block", String(correctablePerBlock(qr.version, qr.ecl))],
          ].map(([k, v]) => (
            <View key={k} style={{ width: (width - 40 - 32 - 20) / 3, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, padding: 10 }}>
              <Text style={{ ...t.typography.overline, fontSize: 10, color: t.colors.inkMuted }}>{k}</Text>
              <Text style={{ ...t.typography.subtitle, ...t.typography.number, color: t.colors.ink }}>{v}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: "segments",
      title: "How the content is packed",
      node: <SegmentStrip segments={qr.segments} single={single} capacity={qr.capacityBits} />,
    },
    {
      key: "map",
      title: "Module map · tap a block",
      node: (
        <View style={{ gap: 14 }}>
          <View style={{ alignItems: "center" }}>
            <AnatomyMap qr={qr} size={mapSize} selected={block} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {KIND_LEGEND.filter((k) => k.key !== "version" || qr.version >= 7).map((k) => (
              <View key={k.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: kindColors[k.key] }} />
                <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>{k.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            Interleaving spreads every block across the whole code, so a scratch in one place damages a little of many blocks instead of all of one. Pale cells are error-correction codewords.
          </Text>
          <BlockLegend qr={qr} damage={code.logoFrac > 0 ? e.damage : null} selected={block} onSelect={setBlock} />
          {code.logoFrac > 0 ? (
            <Text style={{ fontSize: 11, color: t.colors.inkFaint }}>Bars: codewords hidden by the logo vs what the block can fix. Thin line — the 60% budget, thick — the limit.</Text>
          ) : null}
        </View>
      ),
    },
    {
      key: "masks",
      title: "Mask choice · tap to preview",
      node: (
        <View style={{ gap: 12 }}>
          <MaskBars penalties={qr.penalties} chosen={qr.mask} preview={mask} onPreview={setMask} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            All 8 masks are tried; the lowest penalty wins (mask {qr.mask}, {minPenalty} points). Penalties punish what confuses scanners: long same-colour runs, solid blocks, patterns that look like the corner finders, and too much dark or light.
          </Text>
          {masked ? (
            <View style={{ alignItems: "center", gap: 8 }}>
              <QRView qr={masked} size={Math.min(220, mapSize)} fg="#000000" bg="#FFFFFF" quiet={2} />
              <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
                Mask {mask}: {qr.penalties[mask!].total} points{mask === qr.mask ? " · chosen" : ` · +${qr.penalties[mask!].total - minPenalty} vs chosen`}
              </Text>
            </View>
          ) : null}
        </View>
      ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.title, color: t.colors.ink }}>Anatomy</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }} numberOfLines={1}>
            Why “{code.title}” looks the way it does
          </Text>
        </View>
      </View>
      {cards.map((c, i) => (
        <Animated.View key={c.key} entering={FadeInDown.delay(staggerDelay(i, 70)).duration(380)} style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: t.colors.border }}>
          <SectionTitle title={c.title} />
          {c.node}
        </Animated.View>
      ))}
    </ScrollView>
  );
}

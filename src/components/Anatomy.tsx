import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { kindColors, seriesColors, statusColor } from "../theme/colors";
import { PressableScale } from "./PressableScale";
import type { Penalty, QrCode } from "../lib/qr/encode.ts";
import type { Segment } from "../lib/qr/segments.ts";
import { LOGO_BUDGET, type DamageReport } from "../lib/damage.ts";
import { haptics } from "../services/haptics";

const blockColor = (b: number) => seriesColors[b % seriesColors.length];

// Карта модулей: функциональные узоры своими цветами, данные — цветом блока,
// слова коррекции — тем же цветом, но бледнее. Выбранный блок подсвечен,
// остальные гаснут — видно, как чередование размазывает блок по всему коду.
export function AnatomyMap({ qr, size, selected }: { qr: QrCode; size: number; selected: number | null }) {
  const t = useTheme();
  const paths = useMemo(() => {
    const out: Record<string, string> = {};
    const add = (key: string, x: number, y: number) => (out[key] = (out[key] ?? "") + `M${x} ${y}h1v1h-1z`);
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++) {
        const k = qr.kind[y][x];
        if (k === "data") {
          const cw = qr.codewordAt[y * qr.size + x];
          if (cw < 0) continue;
          add(`b${qr.blockOf[cw]}${qr.isEccWord[cw] ? "e" : "d"}`, x, y);
        } else if (qr.modules[y][x] || k === "remainder") add(k, x, y);
      }
    return out;
  }, [qr]);
  return (
    <Svg width={size} height={size} viewBox={`-1 -1 ${qr.size + 2} ${qr.size + 2}`}>
      <Rect x={-1} y={-1} width={qr.size + 2} height={qr.size + 2} fill={t.colors.surface} />
      {Object.entries(paths).map(([key, d]) => {
        if (key.startsWith("b")) {
          const b = Number(key.slice(1, -1));
          const ecc = key.endsWith("e");
          const dim = selected !== null && selected !== b;
          return <Path key={key} d={d} fill={blockColor(b)} opacity={dim ? 0.08 : ecc ? 0.45 : 1} />;
        }
        return <Path key={key} d={d} fill={kindColors[key as keyof typeof kindColors] ?? t.colors.ink} opacity={selected !== null ? 0.35 : 1} />;
      })}
    </Svg>
  );
}

export function BlockLegend({ qr, damage, selected, onSelect }: { qr: QrCode; damage: DamageReport | null; selected: number | null; onSelect: (b: number | null) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {qr.blocks.map((b, i) => {
        const load = damage?.blocks[i];
        const ratio = load ? load.ratio : 0;
        const tone = ratio > 1 ? "fail" : ratio > LOGO_BUDGET ? "warn" : "ok";
        return (
          <PressableScale
            key={i}
            onPress={() => {
              haptics.tick();
              onSelect(selected === i ? null : i);
            }}
            style={{ gap: 5, opacity: selected !== null && selected !== i ? 0.45 : 1 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: blockColor(i) }} />
              <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>Block {i + 1}</Text>
              <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
                {b.data} data + {b.ecc} ecc
              </Text>
            </View>
            {load ? <LoadBar ratio={ratio} label={`${load.hit}/${load.capacity}`} color={statusColor[tone]} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

function LoadBar({ ratio, label, color }: { ratio: number; label: string; color: string }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.min(1.25, ratio) / 1.25, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [ratio]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: "hidden" }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, style]} />
        {/* Пунктир бюджета (60%) и предела (100%) коррекции блока. */}
        <View style={{ position: "absolute", left: `${(LOGO_BUDGET / 1.25) * 100}%`, top: 0, bottom: 0, width: 1, backgroundColor: t.colors.inkFaint }} />
        <View style={{ position: "absolute", left: `${(1 / 1.25) * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: t.colors.ink }} />
      </View>
      <Text style={{ fontSize: 11, ...t.typography.number, color: t.colors.inkMuted, width: 44, textAlign: "right" }}>{label}</Text>
    </View>
  );
}

const MODE_LABEL = { numeric: "Numeric", alnum: "Alphanumeric", byte: "Byte" } as const;
const MODE_COLOR = { numeric: seriesColors[2], alnum: seriesColors[0], byte: seriesColors[1] } as const;

// Полоса сегментов: ширина — биты, цвет — режим; ниже — во сколько бит
// обошёлся бы текст одним режимом.
export function SegmentStrip({ segments, single, capacity }: { segments: Segment[]; single: number; capacity: number }) {
  const t = useTheme();
  const used = segments.reduce((s, x) => s + x.bits, 0);
  const max = Math.max(capacity, single);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", height: 22, borderRadius: 6, overflow: "hidden", backgroundColor: t.colors.surfaceAlt }}>
        {segments.map((s, i) => (
          <SegmentBar key={i} flex={s.bits / max} color={MODE_COLOR[s.mode]} delay={i * 80} />
        ))}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt }}>
        <View style={{ width: `${(single / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: t.colors.inkFaint }} />
      </View>
      <View style={{ gap: 4 }}>
        {segments.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: MODE_COLOR[s.mode] }} />
            <Text style={{ ...t.typography.caption, color: t.colors.ink, width: 100 }}>{MODE_LABEL[s.mode]}</Text>
            <Text style={{ ...t.typography.caption, ...t.typography.mono, color: t.colors.inkMuted, flex: 1 }} numberOfLines={1}>
              {s.text}
            </Text>
            <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>{s.bits} b</Text>
          </View>
        ))}
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
        {used} of {capacity} bits used.{" "}
        {single > used ? `One mode for everything would take ${single} bits — ${single - used} more.` : "A single mode is already optimal here."}
      </Text>
    </View>
  );
}

function SegmentBar({ flex, color, delay }: { flex: number; color: string; delay: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = 0;
    w.value = withDelay(delay, withTiming(flex, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [flex]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <Animated.View style={[{ height: "100%", backgroundColor: color, borderRightWidth: 2, borderRightColor: "#FFFFFF" }, style]} />;
}

const RULES: { key: keyof Omit<Penalty, "total">; label: string; color: string }[] = [
  { key: "runs", label: "Long runs", color: seriesColors[0] },
  { key: "boxes", label: "2×2 boxes", color: seriesColors[1] },
  { key: "finderLike", label: "Finder look-alikes", color: seriesColors[6] },
  { key: "balance", label: "Dark/light balance", color: seriesColors[3] },
];

// 8 масок столбцами, стопка по четырём правилам штрафа. Тап — показать код с этой маской.
export function MaskBars({ penalties, chosen, preview, onPreview }: { penalties: Penalty[]; chosen: number; preview: number | null; onPreview: (m: number | null) => void }) {
  const t = useTheme();
  const max = Math.max(...penalties.map((p) => p.total));
  const H = 120;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: H + 18, gap: 6 }}>
        {penalties.map((p, m) => (
          <PressableScale
            key={m}
            onPress={() => {
              haptics.tick();
              onPreview(preview === m ? null : m);
            }}
            style={{ flex: 1, alignItems: "center", opacity: preview !== null && preview !== m ? 0.4 : 1 }}
          >
            <View style={{ width: "100%", height: H, justifyContent: "flex-end" }}>
              {RULES.map((r) => (
                <View key={r.key} style={{ height: (p[r.key] / max) * H, backgroundColor: r.color, borderTopWidth: 1, borderTopColor: t.colors.surface }} />
              ))}
            </View>
            <Text style={{ fontSize: 11, ...t.typography.number, color: m === chosen ? t.colors.accent : t.colors.inkMuted, fontWeight: m === chosen ? "700" : "400" }}>
              {m === chosen ? `▲${m}` : m}
            </Text>
          </PressableScale>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {RULES.map((r) => (
          <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.color }} />
            <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>{r.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { GRID_N, gridValue, quantile } from "../lib/profile.ts";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Распределение порога θ профиля печати (лог-шкала): чем уже горб, тем
// увереннее модель. Вертикали — 10/90 перцентили и текущий размер модуля
// на выбранной дистанции: правее горба — с запасом, внутри — лотерея.
export function PosteriorCurve({ posterior, current, height = 120 }: { posterior: number[]; current: number | null; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const max = Math.max(...posterior);
  const x = (i: number) => (i / (GRID_N - 1)) * w;
  const xOf = (v: number) => (Math.log(v / gridValue(0)) / Math.log(gridValue(GRID_N - 1) / gridValue(0))) * w;
  const H = height - 18;
  const d = posterior.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${H - (p / max) * (H - 6)}`).join(" ");
  const area = `${d} L${w} ${H} L0 ${H} Z`;
  const lo = quantile(posterior, 0.1);
  const hi = quantile(posterior, 0.9);
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [d]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: 2000 * (1 - reveal.value) }));
  const ticks = [0.1, 0.2, 0.5, 1];
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Rect x={xOf(lo)} y={0} width={Math.max(1, xOf(hi) - xOf(lo))} height={H} fill={t.colors.accentSoft} />
          <Path d={area} fill={t.colors.accent} opacity={0.12} />
          <AnimatedPath d={d} stroke={t.colors.accent} strokeWidth={2} fill="none" strokeDasharray={2000} animatedProps={props} />
          {current !== null ? <Line x1={xOf(current)} x2={xOf(current)} y1={0} y2={H} stroke={t.colors.ink} strokeWidth={2} strokeDasharray="4 3" /> : null}
          <Line x1={0} x2={w} y1={H} y2={H} stroke={t.colors.border} strokeWidth={1} />
          {ticks.map((v) => (
            <Line key={v} x1={xOf(v)} x2={xOf(v)} y1={H} y2={H + 4} stroke={t.colors.inkFaint} strokeWidth={1} />
          ))}
        </Svg>
      ) : null}
      {w > 0 ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: height - 14, height: 14 }}>
          {ticks.map((v) => (
            <Text key={v} style={{ position: "absolute", left: xOf(v) - 14, width: 28, textAlign: "center", fontSize: 9, ...t.typography.number, color: t.colors.inkFaint }}>
              {v}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Код в натуральную величину рядом с линейкой в мм — чтобы "30 мм" стало
// ощутимым на экране телефона (масштаб по плотности пикселей, ±).
export function PrintRuler({ printMm, pxPerMm, maxWidth }: { printMm: number; pxPerMm: number; maxWidth: number }) {
  const t = useTheme();
  const px = Math.min(maxWidth - 30, printMm * pxPerMm);
  const scaled = px < printMm * pxPerMm;
  const marks = scaled ? Math.floor(printMm) : Math.floor(px / pxPerMm);
  return (
    <View style={{ gap: 6 }}>
      <Svg width={px + 2} height={22}>
        <Line x1={1} x2={px + 1} y1={20} y2={20} stroke={t.colors.ink} strokeWidth={1.5} />
        {Array.from({ length: marks + 1 }, (_, i) => {
          const big = i % 10 === 0;
          const mid = i % 5 === 0;
          const xx = 1 + (scaled ? (i / printMm) * px : i * pxPerMm);
          return <Line key={i} x1={xx} x2={xx} y1={big ? 6 : mid ? 11 : 15} y2={20} stroke={t.colors.ink} strokeWidth={big ? 1.5 : 1} />;
        })}
      </Svg>
      <Text style={{ fontSize: 11, ...t.typography.number, color: t.colors.inkMuted }}>
        {printMm} mm{scaled ? " (scaled to fit)" : " · roughly actual size"}
      </Text>
    </View>
  );
}

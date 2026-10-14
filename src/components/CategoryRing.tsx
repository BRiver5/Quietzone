import { useEffect } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RingSegment = { key: string; value: number; color: string };

// Интерактивный донат: тап по сегменту — по углу касания, не по маленькой
// легенде — выбирает срез, повторный тап снимает. Выбранный сегмент толще,
// остальные гаснут. Сегменты идут в ФИКСИРОВАННОМ порядке категорий, чтобы
// цвет всегда принадлежал категории, а не её месту по величине.
export function CategoryRing({ segments, selected, onSelect, size = 170, center }: { segments: RingSegment[]; selected: string | null; onSelect: (key: string | null) => void; size?: number; center?: React.ReactNode }) {
  const t = useTheme();
  const stroke = 20;
  const r = (size - stroke - 10) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const a = { ...s, start: acc, frac };
      acc += frac;
      return a;
    });

  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - size / 2;
    const dy = locationY - size / 2;
    const dist = Math.hypot(dx, dy);
    if (dist < r - stroke || dist > r + stroke) return onSelect(null);
    let ang = Math.atan2(dy, dx) / (2 * Math.PI) + 0.25;
    if (ang < 0) ang += 1;
    const hit = arcs.find((a) => ang >= a.start && ang < a.start + a.frac);
    if (hit) onSelect(selected === hit.key ? null : hit.key);
  };

  return (
    <Pressable onPress={onPress} style={{ width: size, height: size }} accessibilityRole="button" accessibilityLabel="Spending by category, tap a slice to filter">
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {total === 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.colors.border} strokeWidth={stroke} fill="none" /> : null}
          {arcs.map((a, i) => (
            <Arc key={a.key} cx={size / 2} r={r} C={C} start={a.start} frac={a.frac} color={a.color} width={selected === a.key ? stroke + 8 : stroke} dim={selected !== null && selected !== a.key} delay={i * 80} />
          ))}
        </G>
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        {center ?? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Tap a slice</Text>}
      </View>
    </Pressable>
  );
}

function Arc({ cx, r, C, start, frac, color, width, dim, delay }: { cx: number; r: number; C: number; start: number; frac: number; color: string; width: number; dim: boolean; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [frac, start]);
  // 2px зазор между сегментами — поверхность между заливками, а не стык цвет-в-цвет.
  const gap = Math.min(2, (frac * C) / 3);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(0, frac * C - gap) * p.value} ${C}` }));
  return <AnimatedCircle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={width} strokeOpacity={dim ? 0.25 : 1} strokeDashoffset={-start * C} fill="none" animatedProps={props} />;
}

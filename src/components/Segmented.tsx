import { useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme";
import { spring } from "../theme/motion";
import { haptics } from "../services/haptics";

// Верхний сегмент-контрол: бегунок едет пружиной по ИЗМЕРЕННЫМ позициям
// вкладок (ширина подписей разная, равное деление врало бы).
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string; badge?: number }[]; value: K; onChange: (k: K) => void }) {
  const t = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (w.value === 0) {
      x.value = l.x;
      w.value = l.w;
    } else {
      x.value = withSpring(l.x, spring.snappy);
      w.value = withSpring(l.w, spring.snappy);
    }
  }, [value, layouts]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));

  return (
    <View style={{ flexDirection: "row", backgroundColor: t.colors.backgroundAlt, borderRadius: t.radius.pill, padding: 4 }}>
      <Animated.View style={[{ position: "absolute", top: 4, bottom: 4, left: 0, borderRadius: t.radius.pill, backgroundColor: t.colors.ink }, pill]} />
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onLayout={(e: LayoutChangeEvent) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts((prev) => ({ ...prev, [it.key]: { x: lx, w: width } }));
            }}
            onPress={() => {
              if (!active) haptics.tick();
              onChange(it.key);
            }}
            style={{ flex: 1, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
          >
            <Text style={{ ...t.typography.label, fontSize: 14, color: active ? t.colors.surface : t.colors.inkMuted }}>{it.label}</Text>
            {it.badge ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: t.colors.signal, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: t.colors.onAccent }}>{it.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

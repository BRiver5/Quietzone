import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme";
import { spring } from "../theme/motion";
import { haptics } from "../services/haptics";

// Строка со свайпами: вправо — основное действие (зелёный слой под строкой),
// влево — второе (сигнальный слой). Порог 84px — действие срабатывает на
// отпускании, строка пружиной возвращается на место. Вертикальный скролл не
// перехватывается: жест активируется только после явного сдвига по X.
const THRESHOLD = 84;

export function SwipeRow({
  children,
  right,
  left,
}: {
  children: React.ReactNode;
  right?: { label: string; icon: React.ReactNode; onTrigger: () => void };
  left?: { label: string; icon: React.ReactNode; onTrigger: () => void };
}) {
  const t = useTheme();
  const x = useSharedValue(0);
  const armed = useSharedValue(0);

  const fire = (dir: 1 | -1) => {
    haptics.press();
    if (dir === 1) right?.onTrigger();
    else left?.onTrigger();
  };
  const tick = () => haptics.tick();

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      let v = e.translationX;
      if (!right && v > 0) v = 0;
      if (!left && v < 0) v = 0;
      x.value = v;
      const a = Math.abs(v) > THRESHOLD ? 1 : 0;
      if (a !== armed.value) {
        armed.value = a;
        runOnJS(tick)();
      }
    })
    .onFinalize(() => {
      if (Math.abs(x.value) > THRESHOLD) runOnJS(fire)(x.value > 0 ? 1 : -1);
      armed.value = 0;
      x.value = withSpring(0, spring.snappy);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const rightBg = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, THRESHOLD], [0, 1], "clamp") }));
  const leftBg = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-THRESHOLD, 0], [1, 0], "clamp") }));

  return (
    <View>
      {right ? (
        <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: t.radius.lg, backgroundColor: t.colors.success, flexDirection: "row", alignItems: "center", paddingLeft: 20, gap: 8 }, rightBg]}>
          {right.icon}
          <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>{right.label}</Text>
        </Animated.View>
      ) : null}
      {left ? (
        <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: t.radius.lg, backgroundColor: t.colors.signal, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingRight: 20, gap: 8 }, leftBg]}>
          <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>{left.label}</Text>
          {left.icon}
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

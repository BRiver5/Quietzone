import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { haptics } from "../services/haptics";

export function Chip({
  label,
  active,
  onPress,
  color,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      scaleTo={0.94}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: active ? t.colors.accent : t.colors.border,
        backgroundColor: active ? t.colors.accent : t.colors.surface,
      }}
    >
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      {icon}
      <Text style={{ ...t.typography.label, color: active ? t.colors.onAccent : t.colors.ink }}>{label}</Text>
    </PressableScale>
  );
}

export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, style]}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
      {right}
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string }) {
  const t = useTheme();
  const btn = (icon: React.ReactNode, delta: number, label: string) => (
    <PressableScale
      accessibilityLabel={label}
      onPress={() => {
        const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
        if (next !== value) {
          haptics.tick();
          onChange(next);
        }
      }}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border, alignItems: "center", justifyContent: "center" }}
    >
      {icon}
    </PressableScale>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {btn(<Minus size={16} color={t.colors.ink} />, -step, "Decrease")}
      <Text style={{ ...t.typography.subtitle, fontFamily: t.typography.number.fontFamily, color: t.colors.ink, minWidth: 64, textAlign: "center" }}>{format ? format(value) : value}</Text>
      {btn(<Plus size={16} color={t.colors.ink} />, step, "Increase")}
    </View>
  );
}

export function IconButton({ onPress, children, label, tone = "plain" }: { onPress: () => void; children: React.ReactNode; label: string; tone?: "plain" | "accent" }) {
  const t = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      scaleTo={0.9}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "accent" ? t.colors.accent : t.colors.surface,
        borderWidth: tone === "accent" ? 0 : 1,
        borderColor: t.colors.border,
      }}
    >
      {children}
    </PressableScale>
  );
}

export function Legend({ rows }: { rows: { color: string; label: string; value: string; dim?: boolean }[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: r.dim ? 0.35 : 1 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.color }} />
          <Text style={{ ...t.typography.caption, color: t.colors.ink, flex: 1 }} numberOfLines={1}>
            {r.label}
          </Text>
          <Text style={{ ...t.typography.label, color: t.colors.inkMuted, fontFamily: t.typography.number.fontFamily }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

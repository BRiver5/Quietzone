import { useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { CircleCheck, CircleX, TriangleAlert, ChevronDown, Wrench } from "lucide-react-native";
import { useTheme } from "../theme";
import { staggerDelay } from "../theme/motion";
import { statusColor, statusSoft } from "../theme/colors";
import { PressableScale } from "./PressableScale";
import type { Check, Fix, Status } from "../lib/advisor.ts";
import { haptics } from "../services/haptics";

export function StatusIcon({ status, size = 18 }: { status: Status; size?: number }) {
  const c = statusColor[status];
  if (status === "ok") return <CircleCheck size={size} color={c} />;
  if (status === "warn") return <TriangleAlert size={size} color={c} />;
  return <CircleX size={size} color={c} />;
}

export const VERDICT_TEXT: Record<Status, string> = { ok: "Scans reliably", warn: "Might struggle", fail: "Won't scan reliably" };

// Список проверок: строка раскрывается по тапу и показывает цифры.
export function ChecksList({ checks }: { checks: Check[] }) {
  const t = useTheme();
  const [open, setOpen] = useState<string | null>(() => checks.find((c) => c.status !== "ok")?.key ?? null);
  return (
    <View style={{ gap: 2 }}>
      {checks.map((c, i) => {
        const isOpen = open === c.key;
        return (
          <Animated.View key={c.key} entering={FadeInDown.delay(staggerDelay(i, 50)).duration(320)} layout={LinearTransition.duration(200)}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => {
                haptics.tick();
                setOpen(isOpen ? null : c.key);
              }}
              style={{ paddingVertical: 10, gap: 6 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <StatusIcon status={c.status} />
                <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{c.label}</Text>
                <ChevronDown size={16} color={t.colors.inkFaint} style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
              </View>
              {isOpen ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginLeft: 28 }}>{c.detail}</Text> : null}
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

// Варианты "как починить": каждый уже проверен прогоном всей цепочки.
export function FixList({ fixes, onApply }: { fixes: Fix[]; onApply: (f: Fix) => void }) {
  const t = useTheme();
  if (!fixes.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {fixes.slice(0, 4).map((f, i) => (
        <Animated.View key={`${f.key}-${f.title}`} entering={FadeInDown.delay(staggerDelay(i)).duration(340)}>
          <PressableScale
            onPress={() => onApply(f)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.colors.surface, borderRadius: t.radius.md, padding: 12, borderWidth: 1, borderColor: i === 0 ? t.colors.accent : t.colors.border }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: statusSoft[f.after.verdict], alignItems: "center", justifyContent: "center" }}>
              <Wrench size={16} color={statusColor[f.after.verdict]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>{f.title}</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{f.detail}</Text>
              <Text style={{ fontSize: 11, ...t.typography.number, color: statusColor[f.after.verdict], marginTop: 2 }}>→ {VERDICT_TEXT[f.after.verdict]}</Text>
            </View>
            <Text style={{ ...t.typography.label, color: t.colors.accent }}>Apply</Text>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Maximize2 } from "lucide-react-native";
import { useTheme } from "../theme";
import { spring } from "../theme/motion";
import { statusColor } from "../theme/colors";
import { QRView, type Highlight } from "./QRView";
import { damageFor, logoSide, LOGO_BUDGET } from "../lib/damage.ts";
import type { QrCode } from "../lib/qr/encode.ts";
import type { LogoIcon } from "../data/repo";
import { haptics } from "../services/haptics";

// Жестовый виджет: ручка в углу логотипа тянется пальцем — размер логотипа
// меняется вживую, а закрытые им модули подсвечиваются цветом НАГРУЗКИ
// своего блока (зелёный — в бюджете, янтарь — сверх 60% исправимого,
// красный — блок уже не исправит). В базу — только по отпусканию.
const STEP = 0.01;
const MAX = 0.45;

export function LogoSizer({
  qr,
  size,
  fg,
  bg,
  quiet,
  logoFrac,
  logoIcon,
  onCommit,
}: {
  qr: QrCode;
  size: number;
  fg: string;
  bg: string;
  quiet: number;
  logoFrac: number;
  logoIcon: LogoIcon;
  onCommit: (frac: number) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState(logoFrac);
  const [dragging, setDragging] = useState(false);
  const startFrac = useSharedValue(logoFrac);
  const lastStep = useSharedValue(Math.round(logoFrac / STEP));
  const lift = useSharedValue(0);
  const committed = useRef(logoFrac);

  useEffect(() => {
    setDraft(logoFrac);
    committed.current = logoFrac;
  }, [logoFrac]);

  const total = qr.size + quiet * 2;
  const cell = size / total;
  const damage = useMemo(() => damageFor(qr, draft), [qr, draft]);

  const highlights: Highlight[] = useMemo(() => {
    if (!dragging || draft <= 0) return [];
    const side = logoSide(qr, draft);
    const start = Math.floor((qr.size - side) / 2);
    const byStatus: Record<"ok" | "warn" | "fail", { x: number; y: number }[]> = { ok: [], warn: [], fail: [] };
    // Рамку на 1 модуль шире самого логотипа видно — это те модули, что он реально закрывает.
    for (let y = start; y < start + side; y++)
      for (let x = start; x < start + side; x++) {
        const cw = qr.codewordAt[y * qr.size + x];
        if (cw < 0) {
          if (qr.kind[y][x] !== "data" && qr.kind[y][x] !== "alignment" && qr.kind[y][x] !== "remainder") byStatus.fail.push({ x, y });
          continue;
        }
        const b = damage.blocks[qr.blockOf[cw]];
        byStatus[b.ratio > 1 ? "fail" : b.ratio > LOGO_BUDGET ? "warn" : "ok"].push({ x, y });
      }
    return (Object.keys(byStatus) as ("ok" | "warn" | "fail")[]).map((k) => ({ cells: byStatus[k], color: statusColor[k] }));
  }, [dragging, draft, damage, qr]);

  const setStep = (s: number) => {
    haptics.tick();
    setDraft(Math.max(0, Math.min(MAX, s * STEP)));
  };
  const begin = () => setDragging(true);
  const finish = (s: number) => {
    setDragging(false);
    const f = Math.max(0, Math.min(MAX, s * STEP));
    if (f !== committed.current) {
      committed.current = f;
      onCommit(f);
    }
  };

  // Сдвиг ручки на d пикселей по диагонали меняет сторону логотипа на 2d (растёт в обе стороны от центра).
  const pan = Gesture.Pan()
    .onBegin(() => {
      startFrac.value = lastStep.value * STEP;
      lift.value = withSpring(1, spring.snappy);
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      const delta = ((e.translationX + e.translationY) / 2) * 2;
      const frac = Math.max(0, Math.min(MAX, startFrac.value + delta / (qr.size * cell)));
      const s = Math.round(frac / STEP);
      if (s !== lastStep.value) {
        lastStep.value = s;
        runOnJS(setStep)(s);
      }
    })
    .onFinalize(() => {
      lift.value = withSpring(0, spring.gentle);
      runOnJS(finish)(lastStep.value);
    });

  useEffect(() => {
    lastStep.value = Math.round(logoFrac / STEP);
  }, [logoFrac]);

  const sideNow = Math.max(logoSide(qr, draft), 3);
  const handleOffset = (quiet + (qr.size + sideNow) / 2) * cell;
  const handleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * 0.25 }] }));

  const w = damage.worst;
  const status = damage.status;
  const tone = status === "broken" ? "fail" : status === "risky" ? "warn" : "ok";

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <QRView qr={qr} size={size} fg={fg} bg={bg} quiet={quiet} logoFrac={draft} logoIcon={logoIcon} highlights={highlights} animate={!dragging} />
        <GestureDetector gesture={pan}>
          <Animated.View
            hitSlop={18}
            style={[
              {
                position: "absolute",
                left: handleOffset - 16,
                top: handleOffset - 16,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: t.colors.accent,
                borderWidth: 3,
                borderColor: t.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 6,
                elevation: 5,
              },
              handleStyle,
            ]}
            accessibilityLabel="Drag to resize the logo"
          >
            <Maximize2 size={14} color={t.colors.onAccent} />
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: draft > 0 ? statusColor[tone] : t.colors.inkFaint }} />
        <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
          {draft <= 0
            ? "No logo · drag the handle to add one"
            : damage.criticalHits.length
              ? `Logo ${Math.round(draft * 100)}% · covers ${damage.criticalHits[0].kind} modules`
              : `Logo ${Math.round(draft * 100)}% · worst block ${w?.hit ?? 0}/${w?.capacity ?? 0} fixable`}
        </Text>
      </View>
    </View>
  );
}

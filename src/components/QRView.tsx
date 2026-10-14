import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Coffee, Link2, Mail, Phone, Star, User, Wifi } from "lucide-react-native";
import type { QrCode } from "../lib/qr/encode.ts";
import { logoSide } from "../lib/damage.ts";
import type { LogoIcon } from "../data/repo";
import { light } from "../theme/colors";

const ICONS: Record<Exclude<LogoIcon, "none">, typeof Wifi> = { wifi: Wifi, link: Link2, phone: Phone, mail: Mail, user: User, star: Star, coffee: Coffee };

// Тёмные модули одним путём: горизонтальные прогоны склеены в прямоугольники.
export function modulesPath(modules: boolean[][], offset: number, pick?: (x: number, y: number) => boolean): string {
  let d = "";
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] && (!pick || pick(x, y))) {
        let end = x;
        while (end + 1 < row.length && row[end + 1] && (!pick || pick(end + 1, y))) end++;
        d += `M${x + offset} ${y + offset}h${end - x + 1}v1h${-(end - x + 1)}z`;
        x = end + 1;
      } else x++;
    }
  });
  return d;
}

export type Highlight = { cells: { x: number; y: number }[]; color: string };

// Код "проявляется" сканирующей линией сверху вниз при каждой смене матрицы:
// поверх лежит шторка цвета фона и уезжает вниз (анимированный ClipPath в
// react-native-svg на Android не перерисовывался — код оставался белым).
export function QRView({
  qr,
  size,
  fg,
  bg,
  quiet,
  logoFrac = 0,
  logoIcon = "none",
  highlights = [],
  animate = true,
  logoGhost = false,
}: {
  qr: QrCode;
  size: number;
  fg: string;
  bg: string;
  quiet: number;
  logoFrac?: number;
  logoIcon?: LogoIcon;
  highlights?: Highlight[];
  animate?: boolean;
  logoGhost?: boolean; // во время жеста логотип полупрозрачен — видно, какие модули он закрывает
}) {
  const total = qr.size + quiet * 2;
  const path = useMemo(() => modulesPath(qr.modules, quiet), [qr, quiet]);
  const reveal = useSharedValue(animate ? 0 : 1);
  const signature = `${qr.version}-${qr.mask}-${qr.codewords.length}-${qr.codewords[0]}-${qr.codewords[qr.codewords.length - 1]}`;

  useEffect(() => {
    if (!animate) return;
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [signature]);

  const coverStyle = useAnimatedStyle(() => ({ top: size * reveal.value, opacity: reveal.value < 1 ? 1 : 0 }));
  const side = logoSide(qr, logoFrac);
  const cell = size / total;
  const Icon = logoIcon !== "none" ? ICONS[logoIcon] : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect x={0} y={0} width={total} height={total} fill={bg} />
        <Path d={path} fill={fg} />
        {highlights.map((h, i) => (
          <Path key={i} d={h.cells.map((c) => `M${c.x + quiet} ${c.y + quiet}h1v1h-1z`).join("")} fill={h.color} opacity={0.75} />
        ))}
        {side > 0 ? (
          <Rect
            x={quiet + (qr.size - side) / 2}
            y={quiet + (qr.size - side) / 2}
            width={side}
            height={side}
            rx={side * 0.22}
            fill={bg}
            opacity={logoGhost ? 0.35 : 1}
          />
        ) : null}
      </Svg>
      {animate ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: bg, borderTopWidth: 2, borderTopColor: light.accent }, coverStyle]} />
      ) : null}
      {side > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: (quiet + (qr.size - side) / 2 + 0.5) * cell,
            top: (quiet + (qr.size - side) / 2 + 0.5) * cell,
            width: (side - 1) * cell,
            height: (side - 1) * cell,
            borderRadius: (side - 1) * cell * 0.24,
            backgroundColor: fg,
            opacity: logoGhost ? 0.3 : 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Icon ? <Icon size={(side - 1) * cell * 0.58} color={bg} strokeWidth={2.2} /> : null}
        </View>
      ) : null}
    </View>
  );
}

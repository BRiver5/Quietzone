import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { contentColors, heatColor, statusColor } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp, designOf, evaluateCached } from "../src/store/appStore";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { CategoryRing } from "../src/components/CategoryRing";
import { Chip, IconButton, Legend, SectionTitle } from "../src/components/Bits";
import { CONTENT_LABELS, type ContentType } from "../src/lib/content.ts";
import { ECL_ORDER } from "../src/lib/qr/tables.ts";
import { activityHeat, weekly, wilson } from "../src/lib/stats.ts";
import { summarize } from "../src/lib/profile.ts";
import { todayLocal } from "../src/lib/time.ts";

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const codes = useApp((s) => s.codes);
  const profiles = useApp((s) => s.profiles);
  const tests = useApp((s) => s.tests);
  const exports = useApp((s) => s.exports);
  const [type, setType] = useState<ContentType | null>(null);
  const today = todayLocal();

  const types = (Object.keys(CONTENT_LABELS) as ContentType[]).filter((k) => codes.some((c) => c.type === k));
  const sel = type ? codes.filter((c) => c.type === type) : codes;
  const ids = new Set(sel.map((c) => c.id));
  const selExports = exports.filter((x) => ids.has(x.codeId));
  const selTests = type ? tests.filter((x) => x.codeId && ids.has(x.codeId)) : tests;
  const evals = useMemo(() => sel.map((c) => evaluateCached(designOf(c, profiles))), [sel, profiles]);
  const verdicts = { ok: 0, warn: 0, fail: 0 };
  for (const e of evals) verdicts[e.verdict]++;
  const eclCounts = ECL_ORDER.map((l) => ({ label: l, value: sel.filter((c) => c.ecl === l).length }));
  const versions = evals.filter((e) => e.qr).map((e) => e.qr!.version);
  const vBuckets = [
    { label: "1–2", value: versions.filter((v) => v <= 2).length },
    { label: "3–4", value: versions.filter((v) => v >= 3 && v <= 4).length },
    { label: "5–6", value: versions.filter((v) => v >= 5 && v <= 6).length },
    { label: "7–10", value: versions.filter((v) => v >= 7 && v <= 10).length },
    { label: "11+", value: versions.filter((v) => v >= 11).length },
  ];
  const heat = activityHeat([...sel.map((c) => c.createdAt.slice(0, 10)), ...selExports.map((x) => x.date), ...selTests.map((x) => x.date)], today, 12);
  const maxHeat = Math.max(1, ...heat.map((h) => h.count));
  const okRate = wilson(selTests.filter((x) => x.ok).length, selTests.length);
  const exportWeeks = weekly(selExports, today, 8);

  const blocks: { key: string; node: React.ReactNode }[] = [
    {
      key: "tiles",
      node: (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile label="Codes" value={sel.length} accent />
          <Tile label="Exports" value={selExports.length} />
          <Tile label="Scan tests" value={selTests.length} />
        </View>
      ),
    },
    {
      key: "types",
      node: (
        <Card title="What you encode" hint={type ? `Showing ${CONTENT_LABELS[type]} only — tap again to clear` : "Tap a slice to focus the whole screen on it"}>
          {types.length ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <CategoryRing
                segments={(Object.keys(CONTENT_LABELS) as ContentType[]).map((k) => ({ key: k, value: codes.filter((c) => c.type === k).length, color: contentColors[k] }))}
                selected={type}
                onSelect={(k) => setType(k as ContentType | null)}
                size={150}
                center={
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ ...t.typography.title, color: t.colors.ink }}>{sel.length}</Text>
                    <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{type ? CONTENT_LABELS[type] : "codes"}</Text>
                  </View>
                }
              />
              <View style={{ flex: 1 }}>
                <Legend rows={types.map((k) => ({ color: contentColors[k], label: CONTENT_LABELS[k], value: String(codes.filter((c) => c.type === k).length), dim: type !== null && type !== k }))} />
              </View>
            </View>
          ) : (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Make a code to see the breakdown.</Text>
          )}
          {types.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Chip label="All" active={type === null} onPress={() => setType(null)} />
              {types.map((k) => (
                <Chip key={k} label={CONTENT_LABELS[k]} color={contentColors[k]} active={type === k} onPress={() => setType(type === k ? null : k)} />
              ))}
            </View>
          ) : null}
        </Card>
      ),
    },
    {
      key: "health",
      node: (
        <Card title="Will they scan" hint="Every code re-checked now with its own print size, distance and printer profile.">
          <View style={{ flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", backgroundColor: t.colors.surfaceAlt }}>
            {(["ok", "warn", "fail"] as const).map((k) => (verdicts[k] ? <View key={k} style={{ flex: verdicts[k], backgroundColor: statusColor[k], borderRightWidth: 2, borderRightColor: t.colors.surface }} /> : null))}
          </View>
          <Legend
            rows={[
              { color: statusColor.ok, label: "Scans reliably", value: String(verdicts.ok) },
              { color: statusColor.warn, label: "Might struggle", value: String(verdicts.warn) },
              { color: statusColor.fail, label: "Won't scan reliably", value: String(verdicts.fail) },
            ]}
          />
        </Card>
      ),
    },
    {
      key: "exports",
      node: (
        <Card title="Prints & shares per week" hint={`${selExports.length} in total, last 8 weeks shown`}>
          <BarChart data={exportWeeks.map((w) => ({ label: String(Number(w.start.slice(8, 10))), value: w.count }))} color={type ? contentColors[type] : t.colors.accent} height={110} />
        </Card>
      ),
    },
    {
      key: "density",
      node: (
        <Card title="Error correction & density" hint="Higher levels and longer content mean more modules — and smaller ones at the same size.">
          <BarChart data={eclCounts} color={t.colors.accentDeep} height={90} />
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>QR versions</Text>
          <BarChart data={vBuckets} color={t.colors.accent} height={90} />
        </Card>
      ),
    },
    {
      key: "heat",
      node: (
        <Card title="Activity, 12 weeks" hint="New codes, exports and scan tests per day. Columns are weeks.">
          <View style={{ flexDirection: "row", gap: 4 }}>
            {Array.from({ length: 12 }, (_, w) => (
              <View key={w} style={{ flex: 1 }}>
                <Heatmap cells={heat.slice(w * 7, w * 7 + 7).map((h) => ({ key: h.date, intensity: h.count < 0 ? -1 : h.count / maxHeat }))} colorForIntensity={heatColor} cellSize={18} gap={4} />
              </View>
            ))}
          </View>
        </Card>
      ),
    },
    {
      key: "tests",
      node: (
        <Card title="Scan tests" hint="Share that scanned, with a 90% interval — few tests, wide interval.">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <AnimatedRing progress={okRate?.p ?? 0} size={96} strokeWidth={10} color={t.colors.accent} trackColor={t.colors.accentSoft}>
              <Text style={{ ...t.typography.subtitle, ...t.typography.number, color: t.colors.ink }}>{okRate ? `${Math.round(okRate.p * 100)}%` : "—"}</Text>
            </AnimatedRing>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ ...t.typography.caption, color: t.colors.ink }}>
                {okRate ? `Between ${Math.round(okRate.lo * 100)}% and ${Math.round(okRate.hi * 100)}% of your codes scan on the first try.` : "No scan tests yet."}
              </Text>
              {profiles.map((p) => {
                const s = summarize(p.posterior, p.tests);
                return (
                  <Text key={p.id} style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
                    {p.name}: {s.recommended.toFixed(2)} mm/10 cm · {p.tests} test{p.tests === 1 ? "" : "s"}
                  </Text>
                );
              })}
            </View>
          </View>
        </Card>
      ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.title, color: t.colors.ink }}>Stats</Text>
      </View>
      {blocks.map((b, i) => (
        <Animated.View key={`${b.key}-${type ?? "all"}`} entering={FadeInDown.delay(staggerDelay(i, 60)).duration(380)}>
          {b.node}
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: t.colors.border }}>
      <View>
        <SectionTitle title={title} />
        {hint ? <Text style={{ fontSize: 11, color: t.colors.inkFaint, marginTop: 3 }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: accent ? t.colors.accent : t.colors.surface, borderRadius: t.radius.lg, padding: 14, borderWidth: accent ? 0 : 1, borderColor: t.colors.border }}>
      <Text style={{ ...t.typography.overline, fontSize: 10, color: accent ? "rgba(255,255,255,0.75)" : t.colors.inkMuted }}>{label}</Text>
      <AnimatedCounter value={value} style={{ fontFamily: t.typography.title.fontFamily, fontSize: 26, color: accent ? t.colors.onAccent : t.colors.ink, padding: 0 }} />
    </View>
  );
}

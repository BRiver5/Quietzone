import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { ArrowLeft, Microscope, Pencil, Printer } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { COLOR_PRESETS, statusColor, statusSoft } from "../../src/theme/colors";
import { staggerDelay } from "../../src/theme/motion";
import { useApp, designOf, evaluateCached, ratioFor } from "../../src/store/appStore";
import { Chip, IconButton, SectionTitle, Stepper } from "../../src/components/Bits";
import { Field, inputStyle } from "../../src/components/Sheet";
import { PressableScale } from "../../src/components/PressableScale";
import { LogoSizer } from "../../src/components/LogoSizer";
import { ChecksList, FixList, StatusIcon, VERDICT_TEXT } from "../../src/components/Checks";
import { SuccessBurst } from "../../src/components/SuccessBurst";
import { suggestFixes, bytesToShrink, type Fix } from "../../src/lib/advisor.ts";
import { CONTENT_FIELDS, CONTENT_LABELS, buildPayload, upperCaseSavings, type Fields } from "../../src/lib/content.ts";
import { chooseVersion } from "../../src/lib/qr/encode.ts";
import { ECL_ORDER, ECL_RECOVERY, type Ecl } from "../../src/lib/qr/tables.ts";
import * as actions from "../../src/store/actions";
import { haptics } from "../../src/services/haptics";
import type { LogoIcon } from "../../src/data/repo";

const LOGO_ICONS: LogoIcon[] = ["none", "link", "wifi", "phone", "mail", "user", "star", "coffee"];

export default function Studio() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const code = useApp((s) => s.codes.find((c) => c.id === id));
  const profiles = useApp((s) => s.profiles);
  const [fields, setFields] = useState<Fields>(code?.fields ?? {});
  const [title, setTitle] = useState(code?.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (code) setFields(code.fields);
  }, [code?.id]);

  const design = useMemo(() => (code ? designOf(code, profiles, { payload: buildPayload(code.type, fields) }) : null), [code, profiles, fields]);
  const e = design ? evaluateCached(design) : null;
  const fixes = useMemo(() => (e ? suggestFixes(e) : []), [e]);
  const eclVersions = useMemo(() => {
    if (!design?.payload) return {} as Record<Ecl, number | null>;
    const out = {} as Record<Ecl, number | null>;
    for (const l of ECL_ORDER) {
      try {
        out[l] = chooseVersion(design.payload, l).version;
      } catch {
        out[l] = null;
      }
    }
    return out;
  }, [design?.payload]);

  if (!code || !e || !design) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 20, alignItems: "center" }}>
        <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>This code no longer exists.</Text>
      </View>
    );
  }

  const qrSize = Math.min(width - 40 - 48, 300);
  const commitFields = () => {
    if (JSON.stringify(fields) !== JSON.stringify(code.fields)) actions.patchCode(code.id, { fields });
  };
  const apply = async (f: Fix) => {
    haptics.success();
    await actions.patchCode(code.id, f.patch);
    setBurst((b) => b + 1);
  };
  const shrink = e.qr ? bytesToShrink(e.qr) : null;
  const upper = upperCaseSavings(design.payload);

  const sections: { key: string; node: React.ReactNode }[] = [
    {
      key: "hero",
      node: (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, overflow: "hidden" }}>
          <BlueprintGrid />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: statusSoft[e.verdict] }}>
            <StatusIcon status={e.verdict} size={20} />
            <Text style={{ ...t.typography.subtitle, color: t.colors.ink, flex: 1 }}>{VERDICT_TEXT[e.verdict]}</Text>
            {e.qr ? <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>v{e.qr.version} · {e.qr.size}² · {e.moduleMm.toFixed(2)} mm</Text> : null}
          </View>
          <View style={{ padding: 24, alignItems: "center" }}>
            {e.qr ? (
              <LogoSizer qr={e.qr} size={qrSize} fg={code.fg} bg={code.bg} quiet={code.quiet} logoFrac={code.logoFrac} logoIcon={code.logoIcon} onCommit={(f) => actions.patchCode(code.id, { logoFrac: f })} />
            ) : (
              <Text style={{ ...t.typography.body, color: t.colors.inkMuted, paddingVertical: 40, textAlign: "center" }}>{e.checks[0]?.detail}</Text>
            )}
            {burst ? (
              <View key={burst} style={{ position: "absolute", top: 16, right: 16 }}>
                <SuccessBurst visible size={48} />
              </View>
            ) : null}
          </View>
        </View>
      ),
    },
    {
      key: "checks",
      node: (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: t.colors.border }}>
          <ChecksList key={e.checks.map((c) => c.status).join()} checks={e.checks} />
        </View>
      ),
    },
  ];

  if (fixes.length)
    sections.push({
      key: "fixes",
      node: (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Ways to make it scan · best first" />
          <FixList fixes={fixes} onApply={apply} />
        </View>
      ),
    });

  sections.push({
    key: "content",
    node: (
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: t.colors.border }}>
        <SectionTitle title={`Content · ${CONTENT_LABELS[code.type]}`} />
        {CONTENT_FIELDS[code.type].map((f) =>
          f.key === "security" ? (
            <Field key={f.key} label={f.label}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["WPA", "WEP"].map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    active={(fields.security || "WPA") === s}
                    onPress={() => {
                      const next = { ...fields, security: s };
                      setFields(next);
                      actions.patchCode(code.id, { fields: next });
                    }}
                  />
                ))}
              </View>
            </Field>
          ) : (
            <Field key={f.key} label={f.label}>
              <TextInput
                value={fields[f.key] ?? ""}
                onChangeText={(v) => setFields({ ...fields, [f.key]: v })}
                onBlur={commitFields}
                placeholder={f.placeholder}
                placeholderTextColor={t.colors.inkFaint}
                autoCorrect={false}
                autoCapitalize="none"
                multiline={f.multiline}
                style={[inputStyle(t), f.multiline ? { minHeight: 70, textAlignVertical: "top" } : null]}
              />
            </Field>
          )
        )}
        <Text style={{ ...t.typography.caption, ...t.typography.mono, color: t.colors.inkMuted }} numberOfLines={3}>
          {design.payload || "—"}
        </Text>
        {shrink ? (
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {shrink} byte{shrink === 1 ? "" : "s"} shorter and it drops to version {e.qr!.version - 1} — bigger modules at the same print size.
          </Text>
        ) : null}
        {upper && upper.upper !== design.payload && upper.safe ? (
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Tip: an all-caps link (“{upper.upper}”) packs tighter — hosts ignore case.</Text>
        ) : null}
      </View>
    ),
  });

  sections.push({
    key: "style",
    node: (
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 16, borderWidth: 1, borderColor: t.colors.border }}>
        <Field label="Error correction" hint="Higher levels survive more damage (and a bigger logo) but need more modules.">
          <View style={{ flexDirection: "row", gap: 8 }}>
            {ECL_ORDER.map((l) => (
              <PressableScale
                key={l}
                onPress={() => {
                  haptics.tick();
                  actions.patchCode(code.id, { ecl: l });
                }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: t.radius.md, borderWidth: 1, borderColor: code.ecl === l ? t.colors.accent : t.colors.border, backgroundColor: code.ecl === l ? t.colors.accent : t.colors.surface, alignItems: "center" }}
              >
                <Text style={{ ...t.typography.subtitle, ...t.typography.number, color: code.ecl === l ? t.colors.onAccent : t.colors.ink }}>{l}</Text>
                <Text style={{ fontSize: 10, color: code.ecl === l ? t.colors.onAccent : t.colors.inkMuted }}>
                  {ECL_RECOVERY[l]} · {eclVersions[l] ? `v${eclVersions[l]}` : "—"}
                </Text>
              </PressableScale>
            ))}
          </View>
        </Field>
        <Field label="Colours">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {COLOR_PRESETS.map((p) => {
              const active = p.fg === code.fg && p.bg === code.bg;
              return (
                <PressableScale key={p.label} onPress={() => actions.patchCode(code.id, { fg: p.fg, bg: p.bg })} style={{ alignItems: "center", gap: 4 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: p.bg, borderWidth: active ? 2.5 : 1, borderColor: active ? t.colors.accent : t.colors.border, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: p.fg }} />
                  </View>
                  <Text style={{ fontSize: 10, color: active ? t.colors.accent : t.colors.inkMuted }}>{p.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Field>
        <Field label="Logo mark" hint="Size it with the handle on the code.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {LOGO_ICONS.map((ic) => (
              <Chip key={ic} label={ic === "none" ? "Solid" : ic[0].toUpperCase() + ic.slice(1)} active={code.logoIcon === ic} onPress={() => actions.patchCode(code.id, { logoIcon: ic, logoFrac: code.logoFrac || 0.15 })} />
            ))}
          </ScrollView>
        </Field>
        <Field label="Quiet zone">
          <Stepper value={code.quiet} onChange={(v) => actions.patchCode(code.id, { quiet: v })} step={1} min={0} max={8} format={(v) => `${v} mod`} />
        </Field>
      </View>
    ),
  });

  sections.push({
    key: "target",
    node: (
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 16, borderWidth: 1, borderColor: t.colors.border }}>
        <SectionTitle title="Where it will be scanned" />
        <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          <Field label="Printed width">
            <Stepper value={code.printMm} onChange={(v) => actions.patchCode(code.id, { printMm: v })} step={5} min={10} max={600} format={(v) => `${v} mm`} />
          </Field>
          <Field label="Scan distance">
            <Stepper value={code.distanceCm} onChange={(v) => actions.patchCode(code.id, { distanceCm: v })} step={5} min={5} max={800} format={(v) => `${v} cm`} />
          </Field>
        </View>
        <Field label="Printer profile" hint={`Size advice uses ${ratioFor(code.profileId, profiles).toFixed(2)} mm of module per 10 cm of distance.`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Rule of thumb" active={!code.profileId} onPress={() => actions.patchCode(code.id, { profileId: null })} />
            {profiles.map((p) => (
              <Chip key={p.id} label={`${p.name}${p.tests ? ` · ${p.tests}` : ""}`} active={code.profileId === p.id} onPress={() => actions.patchCode(code.id, { profileId: p.id })} />
            ))}
          </View>
        </Field>
      </View>
    ),
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 110, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ArrowLeft size={18} color={t.colors.ink} />
          </IconButton>
          {editingTitle ? (
            <TextInput
              autoFocus
              value={title}
              onChangeText={setTitle}
              onBlur={() => {
                setEditingTitle(false);
                if (title.trim() && title.trim() !== code.title) actions.patchCode(code.id, { title: title.trim() });
                else setTitle(code.title);
              }}
              style={{ flex: 1, ...t.typography.title, fontSize: 19, color: t.colors.ink, borderBottomWidth: 2, borderColor: t.colors.accent, paddingVertical: 2 }}
            />
          ) : (
            <PressableScale
              onPress={() => {
                setTitle(code.title);
                setEditingTitle(true);
              }}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={{ ...t.typography.title, fontSize: 19, color: t.colors.ink, flexShrink: 1 }} numberOfLines={1}>
                {code.title}
              </Text>
              <Pencil size={13} color={t.colors.inkFaint} />
            </PressableScale>
          )}
          <IconButton label="Anatomy" onPress={() => router.push(`/anatomy/${code.id}`)}>
            <Microscope size={18} color={t.colors.ink} />
          </IconButton>
        </View>
        {sections.map((s, i) => (
          <Animated.View key={s.key} entering={FadeInDown.delay(staggerDelay(i, 60)).duration(380)}>
            {s.node}
          </Animated.View>
        ))}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 14, backgroundColor: t.colors.background, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <PressableScale
          onPress={() => router.push(`/print/${code.id}`)}
          style={{ backgroundColor: t.colors.accent, borderRadius: t.radius.pill, paddingVertical: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}
        >
          <Printer size={18} color={t.colors.onAccent} />
          <Text style={{ ...t.typography.subtitle, color: t.colors.onAccent }}>Print, share & test</Text>
        </PressableScale>
      </View>
    </View>
  );
}

// Сетка "чертёжной бумаги" за кодом — шаг 12 px, тонкие линии.
function BlueprintGrid() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = width;
  const lines = Math.ceil(w / 12);
  return (
    <Svg width={w} height={w} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
      {Array.from({ length: lines }, (_, i) => (
        <Line key={`v${i}`} x1={i * 12} x2={i * 12} y1={0} y2={w} stroke={t.colors.grid} strokeWidth={i % 5 === 0 ? 1 : 0.5} />
      ))}
      {Array.from({ length: lines }, (_, i) => (
        <Line key={`h${i}`} x1={0} x2={w} y1={i * 12} y2={i * 12} stroke={t.colors.grid} strokeWidth={i % 5 === 0 ? 1 : 0.5} />
      ))}
    </Svg>
  );
}
